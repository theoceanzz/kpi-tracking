package com.kpitracking.mapper;

import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.Organization;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", uses = {OrgHierarchyLevelMapper.class})
public interface OrganizationMapper {

    OrganizationResponse toResponse(Organization organization);
}
