package com.kpitracking.mapper;

import com.kpitracking.dto.response.organization.HierarchyLevelResponse;
import com.kpitracking.entity.OrgHierarchyLevel;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface OrgHierarchyLevelMapper {
    HierarchyLevelResponse toResponse(OrgHierarchyLevel level);
}
