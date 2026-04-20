package com.kpitracking.mapper;

import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaSummaryResponse;
import com.kpitracking.entity.KpiCriteria;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface KpiCriteriaMapper {

    @Mapping(source = "orgUnit.id", target = "orgUnitId")
    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    @Mapping(source = "assignees", target = "assignees")
    @Mapping(source = "createdBy.id", target = "createdById")
    @Mapping(source = "createdBy.fullName", target = "createdByName")
    @Mapping(source = "approvedBy.id", target = "approvedById")
    @Mapping(source = "approvedBy.fullName", target = "approvedByName")
    @Mapping(source = "assignees", target = "assigneeIds")
    @Mapping(source = "assignees", target = "assigneeNames")
    KpiCriteriaResponse toResponse(KpiCriteria kpiCriteria);

    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    @Mapping(source = "assignees", target = "assigneeNames")
    KpiCriteriaSummaryResponse toSummaryResponse(KpiCriteria kpiCriteria);

    default java.util.List<String> mapAssigneeNames(java.util.List<com.kpitracking.entity.User> assignees) {
        if (assignees == null) return java.util.Collections.emptyList();
        return assignees.stream()
                .map(com.kpitracking.entity.User::getFullName)
                .toList();
    }

    default java.util.List<java.util.UUID> mapAssigneeIds(java.util.List<com.kpitracking.entity.User> assignees) {
        if (assignees == null) return java.util.Collections.emptyList();
        return assignees.stream()
                .map(com.kpitracking.entity.User::getId)
                .toList();
    }
}
