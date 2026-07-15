package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class OrgUnitStatisticToolRequests {
    private OrgUnitStatisticToolRequests() {}

    // LƯU Ý: chỉ khai báo tham số mà tool THẬT SỰ dùng. Tham số thừa vẫn được model truyền vào
    // rồi bị lờ đi âm thầm (vd hỏi "nhân viên phòng IT trong tháng 7" -> ngày bị bỏ, model tưởng
    // đã lọc), đồng thời phình schema gửi lại ở MỖI vòng gọi tool.
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgHierarchyRequest() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgUnitDetailRequest(
            @JsonProperty(required = false) String unitName,  // tên đơn vị đích (vd "Phòng truyền thông"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetChildOrgUnitsRequest(
            @JsonProperty(required = false) String unitName,  // tên đơn vị cha đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean recursive,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetMembersRequest(
            @JsonProperty(required = false) String unitName,  // tên đơn vị đích (vd "phòng IT"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean includeChildUnits,
            @JsonProperty(required = false) String positionId,
            @JsonProperty(required = false) String positionName,  // tên chức vụ (thay cho positionId — khỏi search_positions)
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetOrgUnitStatisticsRequest(
            @JsonProperty(required = false) String unitName,  // tên đơn vị đích (vd "phòng IT"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean includeChildUnits,
            @JsonProperty(required = false) String positionName,  // lọc nhóm theo tên chức vụ (khỏi search_positions)
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
            @JsonProperty(required = false) String unitName,   // tên đơn vị đích (vd "phòng IT"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,     // hoặc UUID đơn vị đích
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
            @JsonProperty(required = false) String unitName,   // tên đơn vị đích (vd "phòng IT"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,     // hoặc UUID đơn vị đích
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
            @JsonProperty(required = false) String kpiId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiPeriodsRequest(
            @JsonProperty(required = false) String unitName,   // tên đơn vị: chỉ liệt kê kỳ đơn vị đó THAM GIA; mặc định = toàn tổ chức
            @JsonProperty(required = false) String unitId,     // hoặc UUID đơn vị đích
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetPositionsRequest(
            @JsonProperty(required = false) String unitName,  // tên đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RankMembersRequest(
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String order,
            @JsonProperty(required = false) String scope,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String unitName,
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) Integer limit,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) String positionFilter,
            @JsonProperty(required = false) String positionName,  // bí danh của positionFilter (khớp tên tham số của get_members/get_org_unit_statistics)
            @JsonProperty(required = false) Boolean managersOnly,
            @JsonProperty(required = false) String unitTypeName
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RankOrgUnitsRequest(
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String order,
            @JsonProperty(required = false) String unitName,  // đơn vị cha cần xếp hạng các đơn vị con; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Integer limit,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiRiskAnalysisRequest(
            @JsonProperty(required = false) String unitName,   // tên đơn vị đích (vd "phòng vận hành"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,     // hoặc UUID đơn vị đích
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetDashboardSummaryRequest(
            @JsonProperty(required = false) String unitName,  // đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
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

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetTimeSeriesRequest(
            @JsonProperty(required = false) String unitName,     // tên đơn vị đích (vd "phòng IT"); mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String metric,       // completion | avg_performance
            @JsonProperty(required = false) String granularity,  // MONTH | QUARTER | YEAR
            @JsonProperty(required = false) Integer lookback      // number of most-recent periods to keep
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetSubmissionHistoryRequest(
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String userId,
            @JsonProperty(required = false) String status,       // PENDING | APPROVED | REJECTED | DRAFT
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) Integer limit        // default 20
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetKpiPeriodBreakdownRequest(
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String userId,
            @JsonProperty(required = false) String granularity,  // MONTH | QUARTER | YEAR
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetNonSubmittersRequest(
            @JsonProperty(required = false) String unitName,   // tên đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String periodId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) Integer limit        // default 20
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CompareOrgUnitsRequest(
            @JsonProperty(required = false) java.util.List<String> unitNames, // 2-5 unit NAMES (preferred; resolved in-tool)
            @JsonProperty(required = false) java.util.List<String> unitIds,   // 2-5 unit IDs (UUID) — alternative to unitNames
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetMyInfoRequest() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GetMembersByPerformanceThresholdRequest(
            @JsonProperty(required = false) String unitName,      // tên đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Double threshold,     // e.g. 80.0 (%)
            @JsonProperty(required = false) String direction,     // below (default) | above
            @JsonProperty(required = false) String metric,        // avg_performance (default) | avg_progress
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) Integer limit         // default 20
    ) {}
}
