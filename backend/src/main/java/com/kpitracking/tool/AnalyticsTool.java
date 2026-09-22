package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.analytics.RankingAnalyticsService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.AnalyticsRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.agent.tool.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Phân tích tổng hợp theo đơn vị — gộp từ get_dashboard_summary, get_time_series và
 * get_kpi_risk_analysis.
 *
 * <p>Cả ba nhận cùng một đầu vào (một đơn vị) và trả một góc nhìn tổng hợp khác nhau về đơn vị đó,
 * nên đứng riêng thì mô tả của chúng phải tự phân biệt với nhau; gộp lại thì view làm việc đó.
 */
@Component
@RequiredArgsConstructor
public class AnalyticsTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final RankingAnalyticsService rankingAnalyticsService;
    private final ToolSupport support;

    @Tool(name = "get_analytics", value = "Phân tích tổng hợp cho một đơn vị và các đơn vị con. "
            // "các chỉ số tổng quan" không phân biệt được với get_kpi(view=summary); nêu đúng
            // phần RIÊNG của nó — bối cảnh tổ chức — và chỉ thẳng sang tool kia khi câu hỏi chỉ
            // xoay quanh chỉ tiêu.
            + "view=dashboard: bức tranh TOÀN ĐƠN VỊ — ngoài số liệu KPI còn có quân số, "
            + "số đơn vị con, số kỳ, số lần nộp trễ. Dùng khi câu hỏi cần cả bối cảnh tổ chức; "
            + "hỏi riêng về KPI thì dùng get_kpi(view=summary). "
            + "view=time_series: diễn biến theo thời gian kèm điểm bất thường — dùng cho câu hỏi về xu hướng "
            + "(vd 'xu hướng hiệu suất 6 tháng qua'); metric=completion (tổng thực tế/tổng mục tiêu %) hoặc "
            + "avg_performance; granularity=MONTH (mặc định)|QUARTER|YEAR; lookback=số kỳ gần nhất (mặc định 6); "
            + "trả về series và anomalyPoints với type=SPIKE (>+20%) hoặc DROP (<-15%). "
            + "view=risk: các KPI đang có nguy cơ trễ, quá hạn hoặc giậm chân tại chỗ. "
            + "view=deviation: ĐƠN VỊ CON nào tự chấm lệch với điểm quản lý chấm nhiều nhất trong đợt đánh giá "
            + "gần nhất (selfScore, managerScore, gap = tự chấm − quản lý; gap dương = tự chấm cao hơn). "
            + "view=rank_delta: BIẾN ĐỘNG thứ hạng các ĐƠN VỊ CON giữa hai ĐỢT đánh giá gần nhất — đơn vị nào lên hạng, "
            + "tụt hạng, điểm đổi bao nhiêu (câu 'so với đợt trước' đi vào đây, không phải rank). "
            + "Hai view này tính theo ĐƠN VỊ và ĐỢT đánh giá; muốn theo từng NGƯỜI thì dùng get_cycle_evaluation(view=users). "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName.")
    public String getAnalytics(AnalyticsRequest request, InvocationParameters context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: dashboard, time_series, risk, deviation, rank_delta.");
            }
            rejectWrongParams(view, request);

            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_analytics", u.clarification());

            Object response = switch (view) {
                case "dashboard" -> support.scoped(orgUnitStatisticService.getDashboardSummary(
                        u.id(), support.getOrgId(context), request.startDate(), request.endDate()), u.id());
                case "time_series" -> orgUnitStatisticService.getTimeSeries(
                        u.id(), request.metric(), request.granularity(), request.lookback());
                case "risk" -> (List<Map<String, Object>>) orgUnitStatisticService.getKpiRiskAnalysis(
                        u.id(), request.startDate(), request.endDate());
                // Hai view dưới lấy từ cùng phép tính với biểu đồ "Tự chấm vs quản lý" và "Biến động thứ
                // hạng" của tab phân tích nâng cao — trợ lý và màn hình nói cùng một số.
                case "deviation" -> rankingAnalyticsService.getSelfVsManager(u.id(), List.of(), null);
                case "rank_delta" -> rankingAnalyticsService.getRankDelta(u.id(), List.of());
                default -> throw new IllegalStateException("view chưa xử lý: " + view);
            };
            return support.respond(context, "get_analytics", response);
        } catch (Exception e) {
            return support.toolError("get_analytics", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "dashboard", "summary", "overview" -> "dashboard";
            case "time_series", "timeseries", "trend", "trends" -> "time_series";
            case "risk", "risks", "risk_analysis" -> "risk";
            case "deviation", "self_vs_manager", "gap", "self_manager_gap" -> "deviation";
            case "rank_delta", "rank_change", "ranking_delta", "rank_movement" -> "rank_delta";
            default -> null;
        };
    }

    /**
     * Tham số của view này truyền vào view kia phải báo lỗi, không được lờ đi: lờ đi thì model
     * tưởng đã lọc theo khoảng thời gian rồi kết luận trên dữ liệu chưa lọc.
     */
    private void rejectWrongParams(String view, AnalyticsRequest r) {
        boolean hasRange = ToolSupport.notBlank(r.startDate()) || ToolSupport.notBlank(r.endDate());
        boolean hasSeriesParams = ToolSupport.notBlank(r.metric())
                || ToolSupport.notBlank(r.granularity()) || r.lookback() != null;

        if ("time_series".equals(view) && hasRange) {
            throw new IllegalArgumentException("view=time_series không dùng startDate/endDate. "
                    + "Hãy dùng lookback (số kỳ gần nhất) và granularity để chọn khoảng thời gian.");
        }
        if (!"time_series".equals(view) && hasSeriesParams) {
            throw new IllegalArgumentException("metric/granularity/lookback chỉ dùng với view=time_series, "
                    + "không dùng với view=" + view + ".");
        }
        if (("deviation".equals(view) || "rank_delta".equals(view)) && hasRange) {
            throw new IllegalArgumentException("view=" + view + " tính theo ĐỢT đánh giá gần nhất, "
                    + "không nhận startDate/endDate.");
        }
    }
}
