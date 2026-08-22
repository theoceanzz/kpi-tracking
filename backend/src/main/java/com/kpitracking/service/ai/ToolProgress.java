package com.kpitracking.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;

import java.util.Map;

/**
 * Báo cho người dùng biết trợ lý vừa tra cứu cái gì.
 *
 * <p><b>Vì sao cần.</b> Vòng gọi tool chiếm phần lớn 10-15 giây của một lượt, mà tiến độ theo công
 * đoạn thì đứng nguyên ở một nhãn suốt quãng đó — nhìn không khác gì treo máy. Mỗi lời gọi tool là
 * một việc CÓ NGHĨA với người dùng ("đang xem danh sách nhân sự"), nên nói ra thì quãng chờ dài nhất
 * cũng thấy có người đang làm việc cho mình.
 *
 * <p><b>Đường đi, và vì sao không cần ThreadLocal.</b> {@code TurnSetupStage} đặt người nghe vào
 * {@code toolCtx}, và Spring AI đưa CÙNG MỘT map đó cho mọi lời gọi tool. Nghĩa là cách này đúng ở
 * bất kỳ luồng nào — miễn nhiễm với chuyện lượt streaming chạy tool trên luồng của reactor, thứ đã
 * làm hỏng bốn kho ThreadLocal khác (xem {@link TurnStatePropagation}).
 *
 * <p><b>Nhãn tới chậm một nhịp.</b> Ba chỗ gọi {@link #announce} đều là chỗ tool TRẢ VỀ, không phải
 * chỗ tool bắt đầu, nên nhãn hiện sau thực tế khoảng một lời gọi tool. Đổi lại, chúng trùng đúng ba
 * chỗ đang ghi {@code AI-TOOL-CALL} nên không đẻ thêm điểm móc nào. Muốn báo sớm hơn thì phải bọc
 * {@code ToolCallback} của Spring AI — không đáng cho phần hiển thị.
 */
@Slf4j
public final class ToolProgress {

    private ToolProgress() {}

    /** Khoá trong {@code toolCtx} giữ người nghe tiến độ của lượt. */
    public static final String CONTEXT_KEY = "progress";

    /**
     * Tên tool → việc mà người dùng hiểu.
     *
     * <p>Nói theo NGHIỆP VỤ chứ không theo tên tool: người dùng cần biết trợ lý đang xem gì của họ,
     * không cần biết hệ thống gọi hàm nào. {@code ToolProgressTest} chốt rằng mọi {@code @Tool} đều
     * có mặt ở đây, nên thêm tool mới mà quên nhãn thì test đỏ chứ không im lặng rơi về nhãn chung.
     */
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("search", "Đang tìm kiếm"),
            Map.entry("get_org_unit", "Đang xem thông tin đơn vị"),
            Map.entry("get_people", "Đang xem danh sách nhân sự"),
            Map.entry("get_kpi", "Đang tra cứu chỉ tiêu KPI"),
            Map.entry("get_submissions", "Đang xem các báo cáo đã nộp"),
            Map.entry("get_analytics", "Đang tổng hợp số liệu"),
            Map.entry("compare_org_units", "Đang so sánh các đơn vị"),
            Map.entry("rank", "Đang xếp hạng"),
            Map.entry("need_other_tools", "Đang mở thêm công cụ"),
            Map.entry("request_evidence_upload", "Đang mở chỗ nhận minh chứng"),
            Map.entry("attach_pinned_files", "Đang đính tệp vào biểu mẫu"),
            Map.entry("suggest_kpi_form", "Đang chuẩn bị đề xuất điền form"),
            Map.entry("suggest_submission_form", "Đang chuẩn bị đề xuất điền form"),
            Map.entry("suggest_evaluation_form", "Đang chuẩn bị đề xuất điền form"),
            Map.entry("suggest_kpi_adjustment_form", "Đang chuẩn bị đề xuất điền form"),
            Map.entry("suggest_org_unit_form", "Đang chuẩn bị đề xuất điền form"),
            Map.entry("suggest_org_unit_drawer_form", "Đang chuẩn bị đề xuất điền form"));

    /** Nhãn của một tool; tool lạ rơi về nhãn chung thay vì lộ tên hàm ra giao diện. */
    public static String label(String toolName) {
        return LABELS.getOrDefault(toolName, "Đang tra cứu dữ liệu");
    }

    public static boolean hasLabel(String toolName) {
        return LABELS.containsKey(toolName);
    }

    /**
     * Phát nhãn của tool vừa chạy. Nuốt mọi lỗi — báo tiến độ là phần thêm, câu trả lời mới là thứ
     * người dùng cần.
     */
    public static void announce(ToolContext context, String toolName) {
        try {
            listenerOf(context).stageStarted("tool:" + toolName, label(toolName));
        } catch (Exception e) {
            log.debug("Báo tiến độ tool {} lỗi ({}), bỏ qua", toolName, e.getMessage());
        }
    }

    private static TurnListener listenerOf(ToolContext context) {
        if (context == null || context.getContext() == null) return TurnListener.NOOP;
        Object listener = context.getContext().get(CONTEXT_KEY);
        return listener instanceof TurnListener l ? l : TurnListener.NOOP;
    }
}
