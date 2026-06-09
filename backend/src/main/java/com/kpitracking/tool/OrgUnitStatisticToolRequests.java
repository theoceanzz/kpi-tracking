package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class OrgUnitStatisticToolRequests {
    private OrgUnitStatisticToolRequests() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgHierarchyRequest(
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgUnitDetailRequest(
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetChildOrgUnitsRequest(
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean recursive,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetMembersRequest(
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean includeChildUnits,
            @JsonProperty(required = false) String positionId,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgUnitStatisticsRequest(
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean includeChildUnits,
            @JsonProperty(required = false) String positionId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetUserSummaryRequest(
            @JsonProperty(required = false) String userId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpisRequest(
            @JsonProperty(required = false) String ownerId,
            @JsonProperty(required = false) String assignedById,
            @JsonProperty(required = false) String assignedToId,
            @JsonProperty(required = false) String periodId,
            @JsonProperty(required = false) String status,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiSummaryRequest(
            @JsonProperty(required = false) String ownerId,
            @JsonProperty(required = false) String assignedById,
            @JsonProperty(required = false) String assignedToId,
            @JsonProperty(required = false) String periodId,
            @JsonProperty(required = false) String status,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiDetailRequest(
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiAssigneesRequest(
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiPeriodsRequest(
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetPositionsRequest(
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RankMembersRequest(
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String order,
            @JsonProperty(required = false) String scope,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) Integer limit,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RankOrgUnitsRequest(
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String order,
            @JsonProperty(required = false) Integer limit,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiRiskAnalysisRequest(
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetDashboardSummaryRequest(
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchUsersRequest(
            @JsonProperty(required = false) String keyword,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String positionName,
            @JsonProperty(required = false) Integer limit
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchOrgUnitsRequest(
            @JsonProperty(required = false) String keyword,
            @JsonProperty(required = false) Integer limit
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchKpisRequest(
            @JsonProperty(required = false) String keyword,
            @JsonProperty(required = false) Integer limit
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchPositionsRequest(
            @JsonProperty(required = false) String keyword,
            @JsonProperty(required = false) Integer limit
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchKpiPeriodsRequest(
            @JsonProperty(required = false) String keyword,
            @JsonProperty(required = false) Integer limit
    ) {}
}
