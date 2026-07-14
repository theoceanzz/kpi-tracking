package com.kpitracking.mapper;

import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.Organization;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {OrgHierarchyLevelMapper.class, EvaluationLevelMapper.class, QualitativeLevelMapper.class})
public interface OrganizationMapper {

    @Mapping(target = "enableAi", source = "enableAi")
    @Mapping(target = "enableOkr", source = "enableOkr")
    @Mapping(target = "enableWaterfall", source = "enableWaterfall")
    @Mapping(target = "enableQualitative", source = "enableQualitative")
    @Mapping(target = "enableBsc", source = "enableBsc")
    OrganizationResponse toResponse(Organization organization);
}
