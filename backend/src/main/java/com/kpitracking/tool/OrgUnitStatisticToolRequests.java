package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class OrgUnitStatisticToolRequests {
    private OrgUnitStatisticToolRequests() {}

    // LƯU Ý: chỉ khai báo tham số mà tool THẬT SỰ dùng. Tham số thừa vẫn được model truyền vào
    // rồi bị lờ đi âm thầm (vd hỏi "nhân viên phòng IT trong tháng 7" -> ngày bị bỏ, model tưởng
    // đã lọc), đồng thời phình schema gửi lại ở MỖI vòng gọi tool.
    

    

    

    

    

    

    

    

    

    

    

    

    /**
     * Tham số của tool `rank` gộp. kpiId/positionName/managersOnly/unitTypeName CHỈ dùng với
     * subject=members — truyền kèm subject=org_units sẽ bị trả lỗi rõ ràng chứ không bị lờ đi.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RankRequest(
            String subject,                                   // members | org_units
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String order,
            @JsonProperty(required = false) String scope,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String unitName,  // với org_units: đơn vị CHA cần xếp hạng các đơn vị con
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) Integer limit,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) String positionFilter,
            @JsonProperty(required = false) String positionName,  // bí danh của positionFilter (khớp tên tham số của get_members)
            @JsonProperty(required = false) Boolean managersOnly,
            @JsonProperty(required = false) String unitTypeName
    ) {}

    /**
     * Tham số của tool `get_org_unit` gộp. recursive/page/size/sortBy/sortDirection CHỈ dùng với
     * view=children.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OrgUnitRequest(
            String view,                                      // detail | hierarchy | children | positions
            @JsonProperty(required = false) String unitName,  // đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) Boolean recursive,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection
    ) {}

    /**
     * Tham số của tool `get_people` gộp. userId CHỈ dùng với view=user_summary; view=me không nhận
     * tham số nhắm đích nào cả.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PeopleRequest(
            String view,                                      // list | statistics | by_performance | user_summary | me
            @JsonProperty(required = false) String unitName,  // đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String userId,    // chỉ với view=user_summary
            @JsonProperty(required = false) Boolean includeChildUnits,
            @JsonProperty(required = false) String positionId,
            @JsonProperty(required = false) String positionName,  // tên chức vụ, thay cho positionId
            @JsonProperty(required = false) Double threshold,     // với view=by_performance
            @JsonProperty(required = false) String direction,     // above | below
            @JsonProperty(required = false) String metric,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection,
            @JsonProperty(required = false) Integer limit
    ) {}

    /**
     * Tham số của tool `get_kpi` gộp. kpiId CHỈ dùng với view=detail|assignees|period_breakdown;
     * unitName/unitId CHỈ dùng với view=list|summary|periods.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record KpiRequest(
            String view,                                      // list | summary | periods | detail | assignees | period_breakdown
            @JsonProperty(required = false) String unitName,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String kpiName,   // với view=assignees: gộp người được giao qua MỌI kỳ trùng tên
            @JsonProperty(required = false) String ownerId,
            @JsonProperty(required = false) String assignedById,
            @JsonProperty(required = false) String assignedToId,
            @JsonProperty(required = false) String userId,    // với view=period_breakdown: lọc theo một người
            @JsonProperty(required = false) String periodId,
            @JsonProperty(required = false) String status,
            @JsonProperty(required = false) String granularity,  // MONTH | QUARTER | YEAR
            @JsonProperty(required = false) Integer page,
            @JsonProperty(required = false) Integer size,
            @JsonProperty(required = false) String sortBy,
            @JsonProperty(required = false) String sortDirection,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    /**
     * Tham số của tool `search` gộp. unitId/positionName CHỈ dùng với entityType=user — truyền
     * kèm loại khác sẽ bị trả lỗi rõ ràng chứ không bị lờ đi.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SearchRequest(
            String entityType,
            String keyword,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String positionName,
            @JsonProperty(required = false) Integer limit
    ) {}

    

    

    

    

    

    

    

    

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CompareOrgUnitsRequest(
            @JsonProperty(required = false) java.util.List<String> unitNames, // 2-5 unit NAMES (preferred; resolved in-tool)
            @JsonProperty(required = false) java.util.List<String> unitIds,   // 2-5 unit IDs (UUID) — alternative to unitNames
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate
    ) {}

    

    

    /**
     * Tham số của tool `get_analytics` gộp. metric/granularity/lookback CHỈ dùng với
     * view=time_series; startDate/endDate CHỈ dùng với view=dashboard|risk. Truyền lẫn sẽ bị
     * trả lỗi rõ ràng chứ không bị lờ đi.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AnalyticsRequest(
            String view,                                          // dashboard | time_series | risk
            @JsonProperty(required = false) String unitName,      // đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) String metric,        // completion | avg_performance
            @JsonProperty(required = false) String granularity,   // MONTH | QUARTER | YEAR
            @JsonProperty(required = false) Integer lookback      // số kỳ gần nhất
    ) {}

    /**
     * Tham số của tool `get_submissions` gộp. kpiName/kpiId/status CHỈ dùng với view=history;
     * unitName/unitId/periodId CHỈ dùng với view=non_submitters.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SubmissionsRequest(
            String view,                                          // history | non_submitters
            @JsonProperty(required = false) String kpiId,
            @JsonProperty(required = false) String kpiName,       // gom bài nộp của MỌI bản cùng tên
            @JsonProperty(required = false) String userId,
            @JsonProperty(required = false) String status,        // PENDING | APPROVED | REJECTED | DRAFT
            @JsonProperty(required = false) String unitName,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String periodId,
            @JsonProperty(required = false) String startDate,
            @JsonProperty(required = false) String endDate,
            @JsonProperty(required = false) Integer limit         // mặc định 20
    ) {}

    /**
     * Tham số của tool `get_bsc`.
     *
     * <p>KHÔNG phơi ra groupBy: {@code BscAnalyticsService.getTrend} gắn mốc theo KỲ chứ không theo
     * tham số đó. KHÔNG phơi sortBy/sortDir của bảng xếp hạng vì tập giá trị hợp lệ chưa được nêu ở
     * đâu — phơi ra là mời model đoán bừa rồi ăn lỗi.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record BscRequest(
            String view,                                          // balance | trend | unit_comparison | vs_system | rankings
            @JsonProperty(required = false) String unitName,      // đơn vị đích; mặc định = đơn vị hiện tại
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String periodName,    // một kỳ, hoặc kỳ ĐẦU của khoảng
            @JsonProperty(required = false) String periodNameTo,  // kỳ CUỐI của khoảng
            @JsonProperty(required = false) String level,         // CHỈ view=vs_system: UNIT | MEMBER
            @JsonProperty(required = false) Integer limit         // CHỈ view=rankings
    ) {}

    /**
     * Tham số của tool `get_okr`. Hai bộ lọc dùng được cho cả hai view nên không có phép loại trừ
     * chéo — khác các tool đọc khác.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OkrRequest(
            String view,                                          // objectives | progress
            @JsonProperty(required = false) String unitName,
            @JsonProperty(required = false) String unitId,
            @JsonProperty(required = false) String perspectiveName, // lọc theo viễn cảnh BSC
            @JsonProperty(required = false) String status           // ACTIVE | COMPLETED | CANCELLED
    ) {}
}
