package com.kpitracking.service;

import com.kpitracking.dto.request.orgunit.CreateOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.MoveOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.UpdateOrgUnitRequest;
import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.entity.District;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.Province;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrgUnitMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrgUnitService {

    private final OrgUnitRepository orgUnitRepository;
    private final OrganizationRepository organizationRepository;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final OrgUnitMapper orgUnitMapper;

    private final RoleRepository roleRepository;
    private final com.kpitracking.repository.OrgHierarchyLevelRepository orgHierarchyLevelRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;

    @Transactional
    public OrgUnitResponse createOrgUnit(UUID orgId, CreateOrgUnitRequest request) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        OrgUnit parent = null;
        int levelOrder = 1;

        if (request.getParentId() != null) {
            parent = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(request.getParentId(), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị cha", "id", request.getParentId()));
            levelOrder = parent.getOrgHierarchyLevel().getLevelOrder() + 1;
        }

        int finalLevelOrder = levelOrder;
        com.kpitracking.entity.OrgHierarchyLevel hierarchyLevel = orgHierarchyLevelRepository
                .findByOrganizationIdOrderByLevelOrderAsc(orgId)
                .stream()
                .filter(l -> l.getLevelOrder() == finalLevelOrder)
                .findFirst()
                .orElseThrow(() -> new BusinessException("Đã đạt giới hạn số lượng cấp bậc phân cấp của tổ chức"));

        if (!hierarchyLevel.getUnitTypeName().equals(request.getUnitTypeName())) {
            hierarchyLevel.setUnitTypeName(request.getUnitTypeName());
            orgHierarchyLevelRepository.save(hierarchyLevel);
        }

        // 1. Kiểm tra trùng tên (Case-insensitive) trong cùng tổ chức
        if (orgUnitRepository.existsByNameIgnoreCaseAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getName(), orgId)) {
            throw new DuplicateResourceException("Thành phần tổ chức", "tên", request.getName());
        }

        String code = request.getCode();
        if (parent == null) {
            code = organization.getCode();
        }

        // 2. Kiểm tra trùng mã (Smart check: Nếu đã xóa thì KHÔI PHỤC, nếu đang dùng thì BÁO LỖI)
        if (orgUnitRepository.existsByCodeSmart(code, orgId)) {
            throw new DuplicateResourceException("Thành phần tổ chức", "mã", code);
        }

        Optional<OrgUnit> deletedUnitOpt = orgUnitRepository.findDeletedByCodeSmart(code, orgId);
        OrgUnit orgUnit;

        if (deletedUnitOpt.isPresent()) {
            // KHÔI PHỤC đơn vị đã xóa
            orgUnit = deletedUnitOpt.get();
            orgUnit.setName(request.getName());
            orgUnit.setOrgHierarchyLevel(hierarchyLevel);
            orgUnit.setDeletedAt(null);
            orgUnit.setStatus(com.kpitracking.enums.OrgUnitStatus.ACTIVE);
        } else {
            // TẠO MỚI đơn vị
            orgUnit = OrgUnit.builder()
                    .name(request.getName())
                    .code(code)
                    .orgHierarchyLevel(hierarchyLevel)
                    .path("/temp/")  // DB trigger will set the real path
                    .build();
        }

        if (parent != null) {
            orgUnit.setParent(parent);
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            if (orgUnitRepository.existsByEmailAndDeletedAtIsNull(request.getEmail())) {
                throw new DuplicateResourceException("Thành phần tổ chức", "email", request.getEmail());
            }
            orgUnit.setEmail(request.getEmail());
        }
        
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            if (orgUnitRepository.existsByPhoneAndDeletedAtIsNull(request.getPhone())) {
                throw new DuplicateResourceException("Thành phần tổ chức", "số điện thoại", request.getPhone());
            }
            orgUnit.setPhone(request.getPhone());
        }
        if (request.getAddress() != null) orgUnit.setAddress(request.getAddress());

        if (request.getProvinceId() != null) {
            Province province = provinceRepository.findById(request.getProvinceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Tỉnh/Thành phố", "id", request.getProvinceId()));
            orgUnit.setProvince(province);
        }
        if (request.getDistrictId() != null) {
            District district = districtRepository.findById(request.getDistrictId())
                    .orElseThrow(() -> new ResourceNotFoundException("Quận/Huyện", "id", request.getDistrictId()));
            orgUnit.setDistrict(district);
        }

        if (request.getRoleIds() != null && !request.getRoleIds().isEmpty()) {
            List<com.kpitracking.entity.Role> allowedRoles = roleRepository.findAllById(request.getRoleIds());
            orgUnit.setAllowedRoles(allowedRoles);
        }

        orgUnit = orgUnitRepository.save(orgUnit);
        // Refresh to get trigger-computed path and level
        orgUnit = orgUnitRepository.findById(orgUnit.getId()).orElseThrow();
        return orgUnitMapper.toResponse(orgUnit);
    }

    @Transactional
    public OrgUnitResponse updateOrgUnit(UUID orgId, UUID unitId, UpdateOrgUnitRequest request) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        if (request.getName() != null && !request.getName().equalsIgnoreCase(orgUnit.getName())) {
            if (orgUnitRepository.existsByNameIgnoreCaseAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getName(), orgId)) {
                throw new DuplicateResourceException("Thành phần tổ chức", "tên", request.getName());
            }
            orgUnit.setName(request.getName());
        }

        if (request.getCode() != null && !request.getCode().equals(orgUnit.getCode())) {
            if (orgUnitRepository.existsByCodeSmart(request.getCode(), orgId)) {
                throw new DuplicateResourceException("Thành phần tổ chức", "mã", request.getCode());
            }
            orgUnit.setCode(request.getCode());
        }

        if (request.getEmail() != null && !request.getEmail().equals(orgUnit.getEmail())) {
            if (!request.getEmail().isBlank() && orgUnitRepository.existsByEmailAndDeletedAtIsNull(request.getEmail())) {
                throw new DuplicateResourceException("Thành phần tổ chức", "email", request.getEmail());
            }
            orgUnit.setEmail(request.getEmail());
        }
        
        if (request.getPhone() != null && !request.getPhone().equals(orgUnit.getPhone())) {
            if (!request.getPhone().isBlank() && orgUnitRepository.existsByPhoneAndDeletedAtIsNull(request.getPhone())) {
                throw new DuplicateResourceException("Thành phần tổ chức", "số điện thoại", request.getPhone());
            }
            orgUnit.setPhone(request.getPhone());
        }
        if (request.getAddress() != null) orgUnit.setAddress(request.getAddress());

        if (request.getProvinceId() != null) {
            Province province = provinceRepository.findById(request.getProvinceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Tỉnh/Thành phố", "id", request.getProvinceId()));
            orgUnit.setProvince(province);
        }
        if (request.getDistrictId() != null) {
            District district = districtRepository.findById(request.getDistrictId())
                    .orElseThrow(() -> new ResourceNotFoundException("Quận/Huyện", "id", request.getDistrictId()));
            orgUnit.setDistrict(district);
        }

        if (request.getRoleIds() != null) {
            Set<UUID> oldRoleIds = orgUnit.getAllowedRoles().stream()
                    .map(com.kpitracking.entity.Role::getId)
                    .collect(Collectors.toSet());
            
            List<com.kpitracking.entity.Role> newAllowedRoles = roleRepository.findAllById(request.getRoleIds());
            
            Set<UUID> newRoleIds = new HashSet<>(request.getRoleIds());
            
            // Identify and revoke removed roles
            for (UUID oldRoleId : oldRoleIds) {
                if (!newRoleIds.contains(oldRoleId)) {
                    // Check if any user is still using this role in this unit
                    if (userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleId(unitId, oldRoleId)) {
                        com.kpitracking.entity.Role role = newAllowedRoles.stream()
                                .filter(r -> r.getId().equals(oldRoleId))
                                .findFirst()
                                .orElse(null);
                        String roleName = role != null ? role.getName() : "này";
                        throw new BusinessException("Không thể bỏ vai trò '" + roleName + "' vì vẫn còn nhân viên đang giữ vai trò này trong đơn vị.");
                    }
                    userRoleOrgUnitRepository.deleteByOrgUnitIdAndRoleId(unitId, oldRoleId);
                }
            }
            
            orgUnit.setAllowedRoles(newAllowedRoles);
        }
        
        if (request.getStatus() != null) {
            try {
                orgUnit.setStatus(com.kpitracking.enums.OrgUnitStatus.valueOf(request.getStatus().toUpperCase()));
            } catch (Exception e) {
                // Ignore invalid status
            }
        }

        orgUnit = orgUnitRepository.save(orgUnit);
        return orgUnitMapper.toResponse(orgUnit);
    }

    @Transactional
    public void softDeleteOrgUnit(UUID orgId, UUID unitId) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        // 1. Kiểm tra nếu có đơn vị con
        if (!orgUnit.getChildren().isEmpty()) {
            throw new BusinessException("Không thể xóa đơn vị này vì vẫn còn các đơn vị con bên trong. Vui lòng xóa hoặc di chuyển các đơn vị con trước.");
        }

        // 2. Kiểm tra nếu có nhân viên đang gán vào đơn vị này
        if (userRoleOrgUnitRepository.existsByOrgUnitId(unitId)) {
            throw new BusinessException("Không thể xóa đơn vị này vì vẫn còn nhân viên/chức vụ đang hoạt động. Vui lòng gỡ bỏ nhân viên khỏi đơn vị trước khi xóa.");
        }

        orgUnit.setDeletedAt(Instant.now());
        orgUnitRepository.save(orgUnit);
    }

    @Transactional
    public OrgUnitResponse moveOrgUnit(UUID orgId, UUID unitId, MoveOrgUnitRequest request) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        if (request.getNewParentId() != null) {
            if (request.getNewParentId().equals(unitId)) {
                throw new BusinessException("Không thể di chuyển đơn vị vào chính nó");
            }
            OrgUnit newParent = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(request.getNewParentId(), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị cha mới", "id", request.getNewParentId()));

            // Check if newParent is a descendant of this node (would create cycle)
            if (newParent.getPath().startsWith(orgUnit.getPath())) {
                throw new BusinessException("Không thể di chuyển đơn vị vào trong nhánh con của nó");
            }
            orgUnit.setParent(newParent);
        } else {
            orgUnit.setParent(null);
        }

        orgUnit = orgUnitRepository.save(orgUnit);
        // Refresh to get trigger-updated path
        orgUnit = orgUnitRepository.findById(orgUnit.getId()).orElseThrow();
        return orgUnitMapper.toResponse(orgUnit);
    }

    @Transactional(readOnly = true)
    public OrgUnitResponse getOrgUnit(UUID orgId, UUID unitId) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));
        return orgUnitMapper.toResponse(orgUnit);
    }

    private com.kpitracking.entity.User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional(readOnly = true)
    public List<OrgUnitTreeResponse> getOrgUnitTree(UUID orgId) {
        organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        com.kpitracking.entity.User currentUser = getCurrentUser();
        
        // 1. If user has ORG:VIEW (Global Admin/Director), show everything
        if (permissionChecker.hasPermission(currentUser.getId(), "ORG:VIEW")) {
            List<OrgUnit> allUnits = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);
            return buildTree(allUnits);
        }

        // 2. If user has ORG:VIEW_TREE (Manager/Deputy), show their units + descendants
        if (permissionChecker.hasPermission(currentUser.getId(), "ORG:VIEW_TREE")) {
            List<UUID> baseUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "ORG:VIEW_TREE");
            if (baseUnitIds.isEmpty()) return Collections.emptyList();
            
            List<OrgUnit> authorizedUnits = orgUnitRepository.findAllInSubtrees(baseUnitIds);
            return buildTree(authorizedUnits);
        }

        return Collections.emptyList();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitTreeResponse> getSubtree(UUID orgId, UUID unitId) {
        OrgUnit root = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        List<OrgUnit> subtreeUnits = orgUnitRepository.findSubtree(root.getPath());
        return buildTree(subtreeUnits);
    }

    @Transactional
    public OrgUnitResponse uploadLogo(UUID orgId, UUID unitId, MultipartFile file) throws IOException {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        String logoUrl = cloudinaryStorageService.uploadFile(file, "org-logos").get("url");
        orgUnit.setLogoUrl(logoUrl);
        orgUnit = orgUnitRepository.save(orgUnit);
        return orgUnitMapper.toResponse(orgUnit);
    }

    private List<OrgUnitTreeResponse> buildTree(List<OrgUnit> units) {
        Map<UUID, OrgUnitTreeResponse> nodeMap = new LinkedHashMap<>();
        for (OrgUnit unit : units) {
            OrgUnitTreeResponse node = orgUnitMapper.toTreeResponse(unit);
            nodeMap.put(unit.getId(), node);
        }

        List<OrgUnitTreeResponse> roots = new ArrayList<>();
        for (OrgUnit unit : units) {
            OrgUnitTreeResponse node = nodeMap.get(unit.getId());
            UUID parentId = unit.getParent() != null ? unit.getParent().getId() : null;
            if (parentId != null && nodeMap.containsKey(parentId)) {
                nodeMap.get(parentId).getChildren().add(node);
            } else {
                roots.add(node);
            }
        }
        return roots;
    }
}
