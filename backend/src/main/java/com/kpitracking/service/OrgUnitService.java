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
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrgUnitMapper;
import com.kpitracking.repository.DistrictRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.ProvinceRepository;
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

    private final com.kpitracking.repository.OrgHierarchyLevelRepository orgHierarchyLevelRepository;

    @Transactional
    public OrgUnitResponse createOrgUnit(UUID orgId, CreateOrgUnitRequest request) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        com.kpitracking.entity.OrgHierarchyLevel hierarchyLevel = orgHierarchyLevelRepository.findById(request.getOrgHierarchyId())
                .orElseThrow(() -> new ResourceNotFoundException("Cấp bậc tổ chức", "id", request.getOrgHierarchyId()));

        if (!hierarchyLevel.getOrganization().getId().equals(orgId)) {
            throw new BusinessException("Cấp bậc không thuộc tổ chức này");
        }

        OrgUnit orgUnit = OrgUnit.builder()
                .name(request.getName())
                .orgHierarchyLevel(hierarchyLevel)
                .path("/temp/")  // DB trigger will set the real path
                .build();

        if (request.getParentId() != null) {
            OrgUnit parent = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(request.getParentId(), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị cha", "id", request.getParentId()));
            orgUnit.setParent(parent);
        }

        if (request.getEmail() != null) orgUnit.setEmail(request.getEmail());
        if (request.getPhone() != null) orgUnit.setPhone(request.getPhone());
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

        orgUnit = orgUnitRepository.save(orgUnit);
        // Refresh to get trigger-computed path and level
        orgUnit = orgUnitRepository.findById(orgUnit.getId()).orElseThrow();
        return orgUnitMapper.toResponse(orgUnit);
    }

    @Transactional
    public OrgUnitResponse updateOrgUnit(UUID orgId, UUID unitId, UpdateOrgUnitRequest request) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));

        if (request.getName() != null) orgUnit.setName(request.getName());
        if (request.getEmail() != null) orgUnit.setEmail(request.getEmail());
        if (request.getPhone() != null) orgUnit.setPhone(request.getPhone());
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

        orgUnit = orgUnitRepository.save(orgUnit);
        return orgUnitMapper.toResponse(orgUnit);
    }

    @Transactional
    public void softDeleteOrgUnit(UUID orgId, UUID unitId) {
        OrgUnit orgUnit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(unitId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", unitId));
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
    public List<OrgUnitTreeResponse> getOrgUnitTree(UUID orgId) {
        organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        List<OrgUnit> allUnits = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);
        return buildTree(allUnits);
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

        String logoUrl = cloudinaryStorageService.uploadFile(file, "org-logos");
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
