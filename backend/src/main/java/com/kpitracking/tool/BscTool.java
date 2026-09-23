package com.kpitracking.tool;

import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.service.BscOverviewService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.BscRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.agent.tool.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Thống kê BSC theo mô hình THẺ ĐIỂM — gộp các phép của tab "Hạng mục BSC".
 *
 * <p><b>Quyền.</b> Tool này nằm ở nhóm {@code BSC}, mà nhóm đó đòi {@code BSC:MANAGE} — đúng bằng
 * mức các endpoint REST tương ứng đòi. Trưởng/phó phòng KHÔNG có quyền đó nên sẽ không bao giờ
 * thấy tool này trong danh sách gửi cho model. Hạ xuống {@code BSC:VIEW} cho "dễ dùng" sẽ biến trợ
 * lý thành đường vòng qua phân quyền: trả về đúng thứ REST API vừa từ chối.
 *
 * <p><b>Phạm vi dữ liệu.</b> {@code AnalyticsScopeResolver} tự kẹp theo người đang đăng nhập nên
 * không có lỗ "cả công ty". Nhưng nhánh {@code orgUnitId != null} của nó chỉ kiểm CÙNG TỔ CHỨC chứ
 * không kiểm cùng cây con — vì vậy tool BẮT BUỘC giải tên đơn vị qua {@code resolveUnit}, hàm đã
 * gọi {@code validateSubtreeAccess}, chứ không nhận id thô từ model rồi truyền thẳng xuống.
 */
@Component
@RequiredArgsConstructor
public class BscTool {

    private final BscAnalyticsService bscAnalyticsService;
    private final BscOverviewService overviewService;
    private final AnalyticsPeriodHelper periodHelper;
    private final ToolSupport support;

    @Tool(name = "get_bsc", value = "Thống kê BSC (thẻ điểm cân bằng) của một đơn vị theo THẺ ĐIỂM. "
            + "view=overview: %đạt BSC của đợt, số thẻ điểm đơn vị theo trạng thái, đơn vị qua/không qua hạng mục chặn, độ phủ phân rã. "
            + "view=units: cây thẻ điểm trải phẳng — %đạt và kết quả hạng mục chặn của từng đơn vị. "
            + "view=items: mức đạt từng chỉ tiêu (thực tế / mục tiêu / sàn / trọng số / chặn) của thẻ điểm. "
            + "view=trend: %đạt BSC qua các đợt, kèm %đạt theo 4 lĩnh vực. "
            + "view=cascade: độ phủ phân rã chỉ tiêu xuống đơn vị (đủ / thiếu / vượt / chưa phân rã). "
            + "view=rankings: xếp hạng nhân sự theo điểm BSC kèm điểm từng lĩnh vực; limit = số dòng. "
            + "Nêu đợt thì truyền periodName; muốn một KHOẢNG đợt thì truyền cả periodName (đợt đầu) và "
            + "periodNameTo (đợt cuối). Bỏ trống: view một đợt lấy đợt muộn nhất có kết quả, view=trend lấy mọi đợt. "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName. "
            + "Đây là BSC — khác hẳn điểm KPI thường; câu hỏi về chỉ tiêu thì dùng get_kpi.")
    public String getBsc(BscRequest request, InvocationParameters context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: "
                        + "overview, units, items, trend, cascade, rankings.");
            }
            rejectWrongParams(view, request);
            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_bsc", u.clarification());
            UUID from = support.resolvePeriodId(request.periodName(), context);
            UUID to = support.resolvePeriodId(request.periodNameTo(), context);
            List<UUID> periodIds = periodHelper.resolvePeriodIds(from, to);
            Object response = switch (view) {
                case "overview" -> overviewService.overview(u.id(), periodIds);
                case "units" -> overviewService.unitAttainment(u.id(), periodIds);
                case "items" -> overviewService.itemAttainment(u.id(), periodIds);
                case "trend" -> overviewService.attainmentTrend(u.id(), periodIds);
                case "cascade" -> overviewService.cascadeCoverage(u.id(), periodIds);
                case "rankings" -> bscAnalyticsService.getRankings(
                        u.id(), periodIds, null, null, 0,
                        request.limit() != null && request.limit() > 0 ? request.limit() : 20);
                default -> throw new IllegalStateException("view chưa xử lý: " + view);
            };
            return support.respond(context, "get_bsc", response);
        } catch (Exception e) {
            return support.toolError("get_bsc", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "overview", "balance", "summary", "health" -> "overview";
            case "units", "unit_attainment", "unit_comparison", "compare_units", "tree" -> "units";
            case "items", "item_attainment", "perspectives", "targets" -> "items";
            case "trend", "trends", "over_time" -> "trend";
            case "cascade", "cascade_coverage", "coverage" -> "cascade";
            case "rankings", "ranking", "rank" -> "rankings";
            default -> null;
        };
    }

    /**
     * Tham số của view này truyền vào view kia phải báo lỗi, không được lờ đi — cùng lý do đã ghi ở
     * các tool đọc khác: lờ đi thì model tưởng đã lọc rồi kết luận trên dữ liệu chưa lọc.
     */
    private void rejectWrongParams(String view, BscRequest r) {
        if (ToolSupport.notBlank(r.level())) {
            throw new IllegalArgumentException("level không còn dùng; view=units đã liệt kê từng đơn vị.");
        }
        if (r.limit() != null && !"rankings".equals(view)) {
            throw new IllegalArgumentException("limit chỉ dùng với view=rankings, không dùng với view="
                    + view + ".");
        }
        if (ToolSupport.notBlank(r.periodNameTo()) && !ToolSupport.notBlank(r.periodName())) {
            throw new IllegalArgumentException("Có periodNameTo thì phải có periodName làm đợt ĐẦU của khoảng.");
        }
    }
}
