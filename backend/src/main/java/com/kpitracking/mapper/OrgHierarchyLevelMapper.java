package com.kpitracking.mapper;

import com.kpitracking.dto.response.organization.HierarchyLevelResponse;
import com.kpitracking.entity.organization.OrgHierarchyLevel;
import org.mapstruct.Mapper;

import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface OrgHierarchyLevelMapper {
    @Mapping(target = "roleLevel", source = "roleLevel")
    HierarchyLevelResponse toResponse(OrgHierarchyLevel level);
}
