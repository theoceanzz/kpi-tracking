package com.kpitracking.mapper;

import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.entity.OrgUnit;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {RoleMapper.class})
public interface OrgUnitMapper {

    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "code", target = "code")
    @Mapping(source = "orgHierarchyLevel.id", target = "orgHierarchyId")
    @Mapping(source = "orgHierarchyLevel.organization.id", target = "organizationId")
    @Mapping(source = "orgHierarchyLevel.unitTypeName", target = "type")
    @Mapping(source = "orgHierarchyLevel.levelOrder", target = "level")
    @Mapping(source = "province.id", target = "provinceId")
    @Mapping(source = "province.name", target = "provinceName")
    @Mapping(source = "district.id", target = "districtId")
    @Mapping(source = "district.name", target = "districtName")
    OrgUnitResponse toResponse(OrgUnit orgUnit);

    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "code", target = "code")
    @Mapping(source = "orgHierarchyLevel.unitTypeName", target = "type")
    @Mapping(source = "orgHierarchyLevel.levelOrder", target = "level")
    @Mapping(target = "children", ignore = true)
    @Mapping(source = "allowedRoles", target = "allowedRoles")
    OrgUnitTreeResponse toTreeResponse(OrgUnit orgUnit);
}
