package com.kpitracking.service;

import com.kpitracking.dto.request.orgunit.CreateOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.MoveOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.UpdateOrgUnitRequest;
import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.entity.*;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrgUnitMapper;
import com.kpitracking.mapper.RoleMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import com.kpitracking.dto.response.orgunit.ImportOrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitExcelResponse;
import com.kpitracking.enums.OrgUnitStatus;

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
    private final RoleMapper roleMapper;
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
            if (orgUnitRepository.existsByEmailAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getEmail(), orgId)) {
                throw new DuplicateResourceException("Thành phần tổ chức", "email", request.getEmail());
            }
            orgUnit.setEmail(request.getEmail());
        }

        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            if (orgUnitRepository.existsByPhoneAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getPhone(), orgId)) {
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
        OrgUnitResponse response = orgUnitMapper.toResponse(orgUnit);
        populateExtraFields(orgUnit, response);
        return response;
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
            if (!request.getEmail().isBlank() && orgUnitRepository.existsByEmailAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getEmail(), orgId)) {
                throw new DuplicateResourceException("Thành phần tổ chức", "email", request.getEmail());
            }
            orgUnit.setEmail(request.getEmail());
        }

        if (request.getPhone() != null && !request.getPhone().equals(orgUnit.getPhone())) {
            if (!request.getPhone().isBlank() && orgUnitRepository.existsByPhoneAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(request.getPhone(), orgId)) {
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
        OrgUnitResponse response = orgUnitMapper.toResponse(orgUnit);
        populateExtraFields(orgUnit, response);
        return response;
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

    private void populateExtraFields(OrgUnit unit, OrgUnitResponse response) {
        response.setMemberCount(userRoleOrgUnitRepository.countUsersByOrganizationUnitId(unit.getId()));
        List<com.kpitracking.entity.Role> activeRoles = userRoleOrgUnitRepository.findDistinctRolesByOrgUnitIdIn(List.of(unit.getId()));
        response.setAssignedRoles(activeRoles.stream().map(roleMapper::toResponse).collect(Collectors.toList()));
    }

    @Transactional(readOnly = true)
    public OrgUnitResponse getOrgUnit(UUID orgId, UUID unitId) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));
        OrgUnitResponse response = orgUnitMapper.toResponse(orgUnit);
        populateExtraFields(orgUnit, response);
        return response;
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
            
            List<OrgUnit> authorizedUnits = orgUnitRepository.findAllInSubtrees(baseUnitIds, orgId);
            return buildTree(authorizedUnits);
        }

        return Collections.emptyList();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitTreeResponse> getSubtree(UUID orgId, UUID unitId) {
        OrgUnit root = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        List<OrgUnit> subtreeUnits = orgUnitRepository.findSubtree(root.getPath(), orgId);
        return buildTree(subtreeUnits);
    }

    @Transactional
    public OrgUnitResponse uploadLogo(UUID orgId, UUID unitId, MultipartFile file) throws IOException {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        String logoUrl = cloudinaryStorageService.uploadFile(file, "org-logos").get("url");
        orgUnit.setLogoUrl(logoUrl);
        orgUnit = orgUnitRepository.save(orgUnit);
        OrgUnitResponse response = orgUnitMapper.toResponse(orgUnit);
        populateExtraFields(orgUnit, response);
        return response;
    }

    private List<OrgUnitTreeResponse> buildTree(List<OrgUnit> units) {
        if (units.isEmpty()) return new ArrayList<>();
        
        List<UUID> unitIds = units.stream().map(OrgUnit::getId).collect(Collectors.toList());
        Map<UUID, Long> memberCountMap = userRoleOrgUnitRepository.countUsersByOrgUnitIdMap(unitIds)
                .stream()
                .collect(Collectors.toMap(
                        obj -> (UUID) obj[0],
                        obj -> (Long) obj[1],
                        (v1, v2) -> v1
                ));

        Map<UUID, List<com.kpitracking.dto.response.role.RoleResponse>> activeRolesMap = new HashMap<>();
        List<UserRoleOrgUnit> allUro = userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds);
        allUro.forEach(uro -> {
            activeRolesMap.computeIfAbsent(uro.getOrgUnit().getId(), k -> new ArrayList<>())
                .add(roleMapper.toResponse(uro.getRole()));
        });

        Map<UUID, OrgUnitTreeResponse> nodeMap = new LinkedHashMap<>();
        for (OrgUnit unit : units) {
            OrgUnitTreeResponse node = orgUnitMapper.toTreeResponse(unit);
            node.setMemberCount(memberCountMap.getOrDefault(unit.getId(), 0L));
            
            List<com.kpitracking.dto.response.role.RoleResponse> roles = activeRolesMap.getOrDefault(unit.getId(), new ArrayList<>());
            // Deduplicate by ID
            Set<UUID> seenIds = new HashSet<>();
            List<com.kpitracking.dto.response.role.RoleResponse> distinctRoles = roles.stream()
                .filter(r -> seenIds.add(r.getId()))
                .collect(Collectors.toList());
            node.setAssignedRoles(distinctRoles);
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

    @Transactional(readOnly = true)
    public List<OrgUnitExcelResponse> exportOrgUnits(UUID orgId) {
        List<OrgUnit> units = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);
        return units.stream()
                .map(unit -> OrgUnitExcelResponse.builder()
                        .name(unit.getName())
                        .code(unit.getCode())
                        .parentCode(unit.getParent() != null ? unit.getParent().getCode() : null)
                        .email(unit.getEmail())
                        .phone(unit.getPhone())
                        .address(unit.getAddress())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public ImportOrgUnitResponse importOrgUnits(UUID orgId, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx"))) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .csv và .xlsx");
        }

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;

        try {
            if (filename.endsWith(".csv")) {
                try (BufferedReader fileReader = new BufferedReader(new InputStreamReader(file.getInputStream(), "UTF-8"));
                     CSVParser csvParser = new CSVParser(fileReader, CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setIgnoreHeaderCase(true).setTrim(true).build())) {

                    Iterable<CSVRecord> csvRecords = csvParser.getRecords();
                    for (CSVRecord csvRecord : csvRecords) {
                        totalRows++;
                        try {
                            processOrgUnitRow(orgId, 
                                    csvRecord.get("Name"),
                                    csvRecord.get("Code"),
                                    csvRecord.isMapped("ParentCode") ? csvRecord.get("ParentCode") : null,
                                    csvRecord.isMapped("Email") ? csvRecord.get("Email") : null,
                                    csvRecord.isMapped("Phone") ? csvRecord.get("Phone") : null,
                                    csvRecord.isMapped("Address") ? csvRecord.get("Address") : null,
                                    csvRecord.isMapped("RoleIds") ? csvRecord.get("RoleIds") : null);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            } else if (filename.endsWith(".xlsx")) {
                try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
                    Sheet sheet = workbook.getSheetAt(0);
                    Row headerRow = sheet.getRow(0);

                    if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

                    int nameIdx = -1, codeIdx = -1, parentCodeIdx = -1, emailIdx = -1, phoneIdx = -1, addrIdx = -1, roleIdsIdx = -1;
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Name")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Code")) codeIdx = i;
                        else if (header.equalsIgnoreCase("ParentCode")) parentCodeIdx = i;
                        else if (header.equalsIgnoreCase("Email")) emailIdx = i;
                        else if (header.equalsIgnoreCase("Phone")) phoneIdx = i;
                        else if (header.equalsIgnoreCase("Address")) addrIdx = i;
                        else if (header.equalsIgnoreCase("RoleIds")) roleIdsIdx = i;
                    }

                    if (nameIdx == -1 || codeIdx == -1) {
                        throw new BusinessException("Thiếu các cột bắt buộc: Name, Code");
                    }

                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;
                        totalRows++;

                        try {
                            processOrgUnitRow(orgId,
                                    getCellValueAsString(row.getCell(nameIdx)),
                                    getCellValueAsString(row.getCell(codeIdx)),
                                    parentCodeIdx != -1 ? getCellValueAsString(row.getCell(parentCodeIdx)) : null,
                                    emailIdx != -1 ? getCellValueAsString(row.getCell(emailIdx)) : null,
                                    phoneIdx != -1 ? getCellValueAsString(row.getCell(phoneIdx)) : null,
                                    addrIdx != -1 ? getCellValueAsString(row.getCell(addrIdx)) : null,
                                    roleIdsIdx != -1 ? getCellValueAsString(row.getCell(roleIdsIdx)) : null);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException("Xử lý tập tin thất bại: " + e.getMessage());
        }

        return ImportOrgUnitResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private String getCellValueAsString(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC) {
            return String.valueOf((long) cell.getNumericCellValue());
        }
        return cell.getStringCellValue().trim();
    }

    private void processOrgUnitRow(UUID orgId, String name, String code, String parentCode, String email, String phone, String address, String roleIds) {
        if (name == null || name.isBlank()) throw new BusinessException("Tên đơn vị là bắt buộc");
        if (code == null || code.isBlank()) throw new BusinessException("Mã đơn vị là bắt buộc");

        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        OrgUnit parent = null;
        int levelOrder = 1;

        if (parentCode != null && !parentCode.isBlank()) {
            parent = orgUnitRepository.findByCodeSmart(parentCode.trim(), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị cha (Mã: " + parentCode + ")", "code", parentCode));
            levelOrder = parent.getOrgHierarchyLevel().getLevelOrder() + 1;
        }

        int finalLevelOrder = levelOrder;
        com.kpitracking.entity.OrgHierarchyLevel hierarchyLevel = orgHierarchyLevelRepository
                .findByOrganizationIdOrderByLevelOrderAsc(orgId)
                .stream()
                .filter(l -> l.getLevelOrder() == finalLevelOrder)
                .findFirst()
                .orElseThrow(() -> new BusinessException("Đã đạt giới hạn số lượng cấp bậc phân cấp cho đơn vị '" + name + "'"));

        Optional<OrgUnit> existingUnitOpt = orgUnitRepository.findByCodeSmart(code, orgId);
        OrgUnit orgUnit;

        if (existingUnitOpt.isPresent()) {
            orgUnit = existingUnitOpt.get();
            orgUnit.setName(name);
            orgUnit.setOrgHierarchyLevel(hierarchyLevel);
        } else {
            Optional<OrgUnit> deletedUnitOpt = orgUnitRepository.findDeletedByCodeSmart(code, orgId);
            if (deletedUnitOpt.isPresent()) {
                orgUnit = deletedUnitOpt.get();
                orgUnit.setDeletedAt(null);
                orgUnit.setName(name);
                orgUnit.setOrgHierarchyLevel(hierarchyLevel);
            } else {
                orgUnit = OrgUnit.builder()
                        .name(name)
                        .code(code)
                        .orgHierarchyLevel(hierarchyLevel)
                        .path("/temp/")
                        .build();
            }
        }

        orgUnit.setParent(parent);
        orgUnit.setEmail(email);
        orgUnit.setPhone(phone);
        orgUnit.setAddress(address);
        orgUnit.setStatus(com.kpitracking.enums.OrgUnitStatus.ACTIVE);

        if (roleIds != null && !roleIds.isBlank()) {
            List<com.kpitracking.entity.Role> roles = Arrays.stream(roleIds.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(UUID::fromString)
                    .map(id -> roleRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            orgUnit.setAllowedRoles(roles);
        }

        orgUnitRepository.save(orgUnit);
    }
}
