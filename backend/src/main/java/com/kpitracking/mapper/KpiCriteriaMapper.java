package com.kpitracking.mapper;

import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaSummaryResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.dto.response.kpi.KpiPeriodResponse;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

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
    @Mapping(source = "kpiPeriod.id", target = "kpiPeriodId")
    @Mapping(source = "keyResult.id", target = "keyResultId")
    @Mapping(source = "keyResult.name", target = "keyResultName")
    @Mapping(source = "keyResult.code", target = "keyResultCode")
    @Mapping(source = "keyResult.objective.id", target = "objectiveId")
    @Mapping(source = "keyResult.objective.name", target = "objectiveName")
    @Mapping(source = "keyResult.objective.code", target = "objectiveCode")
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "parent.name", target = "parentName")
    @Mapping(target = "submissionCount", expression = "java(countActiveSubmissions(kpiCriteria))")
    @Mapping(target = "expectedSubmissions", expression = "java(calculateExpected(kpiCriteria))")
    KpiCriteriaResponse toResponse(KpiCriteria kpiCriteria);

    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    @Mapping(source = "assignees", target = "assigneeNames")
    @Mapping(target = "submissionCount", expression = "java(countActiveSubmissions(kpiCriteria))")
    @Mapping(target = "expectedSubmissions", expression = "java(calculateExpected(kpiCriteria))")
    KpiCriteriaSummaryResponse toSummaryResponse(KpiCriteria kpiCriteria);



    default int countActiveSubmissions(com.kpitracking.entity.KpiCriteria kpi) {
        if (kpi.getSubmissions() == null) return 0;
        return (int) kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null && 
                             (s.getStatus() == com.kpitracking.enums.SubmissionStatus.PENDING || 
                              s.getStatus() == com.kpitracking.enums.SubmissionStatus.APPROVED ||
                              s.getStatus() == com.kpitracking.enums.SubmissionStatus.REJECTED))
                .count();
    }

    default int calculateExpected(com.kpitracking.entity.KpiCriteria kpi) {
        if (kpi.getFrequency() == null || kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getPeriodType() == null) {
            return 1;
        }
        return calculateExpected(kpi.getFrequency(), kpi.getKpiPeriod().getPeriodType());
    }

    private int calculateExpected(com.kpitracking.enums.KpiFrequency kpiFreq, com.kpitracking.enums.KpiFrequency periodType) {
        if (kpiFreq == periodType) return 1;
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.DAILY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 30;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 90;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 365;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.WEEKLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 4;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 13;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 52;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.MONTHLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 3;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 12;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.QUARTERLY && periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 4;
        return 1;
    }



    @Mapping(source = "organization.id", target = "organizationId")
    KpiPeriodResponse toKpiPeriodResponse(KpiPeriod kpiPeriod);

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
