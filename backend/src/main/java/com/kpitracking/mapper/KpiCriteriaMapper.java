package com.kpitracking.mapper;

import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaSummaryResponse;
import com.kpitracking.entity.KpiCriteria;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface KpiCriteriaMapper {

    @Mapping(source = "department.id", target = "departmentId")
    @Mapping(source = "department.name", target = "departmentName")
    @Mapping(source = "assignedTo.id", target = "assignedToId")
    @Mapping(source = "assignedTo.fullName", target = "assignedToName")
    @Mapping(source = "createdBy.id", target = "createdById")
    @Mapping(source = "createdBy.fullName", target = "createdByName")
    @Mapping(source = "approvedBy.id", target = "approvedById")
    @Mapping(source = "approvedBy.fullName", target = "approvedByName")
    KpiCriteriaResponse toResponse(KpiCriteria kpiCriteria);

    @Mapping(source = "department.name", target = "departmentName")
    @Mapping(source = "assignedTo.fullName", target = "assignedToName")
    KpiCriteriaSummaryResponse toSummaryResponse(KpiCriteria kpiCriteria);
}
