package com.kpitracking.mapper;

import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.entity.OrgUnit;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface OrgUnitMapper {

    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "organization.id", target = "organizationId")
    @Mapping(source = "province.id", target = "provinceId")
    @Mapping(source = "province.name", target = "provinceName")
    @Mapping(source = "district.id", target = "districtId")
    @Mapping(source = "district.name", target = "districtName")
    OrgUnitResponse toResponse(OrgUnit orgUnit);

    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(target = "children", ignore = true)
    OrgUnitTreeResponse toTreeResponse(OrgUnit orgUnit);
}
