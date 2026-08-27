package com.kpitracking.tool;

import com.kpitracking.dto.response.stats.BscAnalyticsResponses.BalanceResponse;
import com.kpitracking.dto.response.stats.BscAnalyticsResponses.PerspectivePoint;
import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.BscRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Thống kê BSC (thẻ điểm cân bằng) theo viễn cảnh — gộp cả 5 phép của tab "Viễn cảnh".
 *
 * <p><b>Quyền.</b> Tool này nằm ở nhóm {@code BSC}, mà nhóm đó đòi {@code BSC:MANAGE} — đúng bằng
 * mức năm endpoint REST tương ứng đòi. Trưởng/phó phòng KHÔNG có quyền đó nên sẽ không bao giờ
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
    private final AnalyticsPeriodHelper periodHelper;
    private final ToolSupport support;

    @Tool(name = "get_bsc", description = "Thống kê BSC (thẻ điểm cân bằng) theo VIỄN CẢNH cho một đơn vị. "
            + "view=balance: cân bằng giữa các viễn cảnh — điểm từng viễn cảnh, viễn cảnh mạnh nhất và yếu nhất "
            + "(dùng cho 'đơn vị tôi cân bằng viễn cảnh thế nào'). "
            + "view=trend: điểm viễn cảnh biến động qua các kỳ. "
            + "view=unit_comparison: so sánh viễn cảnh giữa các đơn vị con. "
            + "view=vs_system: đối chiếu điểm BSC với điểm hệ thống; level=UNIT (mặc định) hoặc MEMBER. "
            + "view=rankings: bảng xếp hạng kèm điểm từng viễn cảnh; limit = số dòng. "
            + "Nêu kỳ thì truyền periodName; muốn một KHOẢNG kỳ thì truyền cả periodName (kỳ đầu) và "
            + "periodNameTo (kỳ cuối). Bỏ trống là tính trên MỌI kỳ. "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName. "
            + "Đây là BSC — khác hẳn điểm KPI thường; câu hỏi về chỉ tiêu thì dùng get_kpi.")
    public String getBsc(BscRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: "
                        + "balance, trend, unit_comparison, vs_system, rankings.");
            }
            rejectWrongParams(view, request);

            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_bsc", u.clarification());

            UUID from = support.resolvePeriodId(request.periodName(), context);
            UUID to = support.resolvePeriodId(request.periodNameTo(), context);
            List<UUID> periodIds = periodHelper.resolvePeriodIds(from, to);

            Object response = switch (view) {
                case "balance" -> perEvaluationContribution(
                        bscAnalyticsService.getBalance(u.id(), periodIds));
                case "trend" -> bscAnalyticsService.getTrend(u.id(), periodIds, "PERIOD");
                case "unit_comparison" -> bscAnalyticsService.getUnitComparison(u.id(), periodIds);
                case "vs_system" -> bscAnalyticsService.getBscVsSystem(
                        u.id(), periodIds, ToolSupport.notBlank(request.level()) ? request.level() : "UNIT");
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

    /**
     * Đổi {@code weightedScore} của mỗi viễn cảnh từ TỔNG CỘNG DỒN sang đóng góp trên MỘT đánh giá.
     *
     * <p>Truy vấn phía dưới trả {@code SUM(weightedScore)} — cộng qua mọi đánh giá trong phạm vi.
     * Con số đó lớn theo SỐ LƯỢT ĐÁNH GIÁ chứ không theo chất lượng, nên viễn cảnh nào nhiều người
     * được giao chỉ tiêu sẽ luôn "cao nhất". Đo được đúng cái bẫy đó ngay câu hỏi đầu tiên trên dữ
     * liệu thật: model đọc bảng rồi kết luận "Quy trình nội bộ đóng góp lớn nhất nhờ điểm có trọng
     * số cao nhất (976,5)", trong khi 976,5 chỉ lớn vì viễn cảnh đó có 42 lượt còn Khách hàng có 24.
     *
     * <p>Thay bằng {@code trọng số% × điểm trung bình}, tức đóng góp của viễn cảnh vào điểm BSC của
     * một người — đại lượng SO SÁNH ĐƯỢC giữa các viễn cảnh và cùng thang với các số còn lại trong
     * bảng. Giữ nguyên tên trường và hình dạng JSON, nên không đụng gì tới giao diện: giao diện gọi
     * service qua REST chứ không qua tool này.
     *
     * <p>Không xoá hẳn trường đi vì model cần một cách để nói viễn cảnh nào kéo điểm tổng; bỏ trống
     * là mời nó tự nhân tay rồi nhân sai.
     */
    private static BalanceResponse perEvaluationContribution(BalanceResponse response) {
        if (response == null || response.getPerspectives() == null) return response;
        for (PerspectivePoint p : response.getPerspectives()) {
            Double weight = p.getWeightPercentage();
            Double avg = p.getAverageScore();
            p.setWeightedScore(weight == null || avg == null
                    ? null
                    : Math.round(weight / 100.0 * avg * 10.0) / 10.0);
        }
        return response;
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "balance", "perspective_balance", "radar" -> "balance";
            case "trend", "trends", "over_time" -> "trend";
            case "unit_comparison", "unitcomparison", "compare_units", "comparison" -> "unit_comparison";
            case "vs_system", "bsc_vs_system", "versus_system" -> "vs_system";
            case "rankings", "ranking", "rank" -> "rankings";
            default -> null;
        };
    }

    /**
     * Tham số của view này truyền vào view kia phải báo lỗi, không được lờ đi — cùng lý do đã ghi ở
     * các tool đọc khác: lờ đi thì model tưởng đã lọc rồi kết luận trên dữ liệu chưa lọc.
     */
    private void rejectWrongParams(String view, BscRequest r) {
        if (ToolSupport.notBlank(r.level()) && !"vs_system".equals(view)) {
            throw new IllegalArgumentException("level chỉ dùng với view=vs_system, không dùng với view="
                    + view + ".");
        }
        if (r.limit() != null && !"rankings".equals(view)) {
            throw new IllegalArgumentException("limit chỉ dùng với view=rankings, không dùng với view="
                    + view + ".");
        }
        if (ToolSupport.notBlank(r.periodNameTo()) && !ToolSupport.notBlank(r.periodName())) {
            throw new IllegalArgumentException("Có periodNameTo thì phải có periodName làm kỳ ĐẦU của khoảng.");
        }
    }
}
