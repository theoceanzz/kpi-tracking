package com.kpitracking.service.ai;

import com.kpitracking.entity.Organization;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.tool.ToolRegistry;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Toàn bộ trạng thái của MỘT lượt hỏi AI, đi xuyên suốt chuỗi {@link AiStage}.
 *
 * <p>Trước đây trạng thái này nằm rải ở ba chỗ: tham số truyền tay (hàm gọi model nhận 6 tham số),
 * biến cục bộ trong {@code AiService.processOrgUnitChat}, và ba ThreadLocal riêng lẻ. Mỗi lần thêm
 * một công đoạn là danh sách tham số dài thêm — dấu hiệu kinh điển của việc thiếu một object
 * ngữ cảnh.
 *
 * <p>Gom về một chỗ để thêm công đoạn mới chỉ là đọc/ghi thêm một trường, không phải sửa chữ ký
 * của các hàm đang có.
 */
@Getter
@Setter
public class AiTurn {

    // ── đầu vào, cố định trong suốt lượt ─────────────────────────────────────
    private final String question;
    private final String conversationId;
    private final String focusUnitId;
    /** Form đang mở trên màn hình người dùng, nếu có. Quyết định trợ lý có được đề xuất điền không. */
    private String openFormId;
    /** Giá trị các ô đang có trong form đó — để không đề xuất lại thứ người dùng đã điền. */
    private Map<String, Object> openFormValues;

    // ── dựng dần qua từng stage ──────────────────────────────────────────────
    private ManagerContext manager;
    private Organization org;
    private UUID effectiveUnitId;
    private Map<String, Object> toolCtx = new HashMap<>();
    private String currentDateTime;
    private boolean hasMemory;

    /** Nhóm tool do tầng định tuyến chọn. */
    private Set<ToolRegistry.Group> groups;
    /** Bộ tool thực sự trao cho model = nhóm ∩ quyền của người dùng. */
    private List<Object> tools;

    // ── chỗ dành sẵn cho các công đoạn sắp thêm ──────────────────────────────
    /** Kế hoạch nhiều bước, khi có PlanningStage. Rỗng/null = lượt này không dùng kế hoạch. */
    private List<PlanStep> plan;
    /**
     * Đề xuất điền form mà tool sinh ra trong lượt này.
     *
     * <p>Pipeline chuyển nó từ ThreadLocal sang đây TRƯỚC khi dọn, vì khối {@code finally} chạy
     * xong rồi {@code run()} mới trả về — tầng gọi đọc ThreadLocal thì luôn nhận null.
     */
    private FormPatch formPatch;
    /**
     * Tên đơn vị của thẻ Insight người dùng bấm, nếu có. {@code TurnSetupStage} gắn khi nó đã nạp
     * đơn vị để kiểm {@code focusUnitId} — không tốn thêm truy vấn nào.
     */
    private String focusUnitName;
    /** Các câu hỏi gợi ý tiếp theo do {@code FollowupStage} sinh; null ở lượt không có gợi ý. */
    private FollowupResponse followups;

    /**
     * Nơi nhận tiến độ của lượt. Mặc định {@link TurnListener#NOOP} nên đường JSON không phải biết
     * gì về streaming, và pipeline không phải kiểm null ở mỗi chỗ phát.
     */
    private TurnListener listener = TurnListener.NOOP;
    /**
     * Các tool đã lên kế hoạch nhưng lượt đầu không gọi — do {@code PlanCompletionStage} đặt trước
     * khi hỏi lại, để khối kế hoạch lần hai chỉ nêu đúng phần còn thiếu thay vì nhắc lại cả kế hoạch.
     */
    private List<String> missingPlannedTools;
    /** Tên các tool đã chạy trong lượt — để stage kiểm duyệt đối chiếu câu trả lời với dữ liệu thật. */
    private List<String> toolCallTrace;

    public AiTurn(String question, String conversationId, String focusUnitId) {
        this.question = question;
        this.conversationId = conversationId;
        this.focusUnitId = focusUnitId;
        this.hasMemory = conversationId != null && !conversationId.isBlank();
    }

    /** Id hội thoại chỉ khi lượt này thực sự có bộ nhớ; ngược lại null. */
    public String memoryConversationId() {
        return hasMemory ? conversationId : null;
    }

    /**
     * Báo cho người dùng biết công đoạn này đang làm gì, NGAY LÚC bắt đầu làm.
     *
     * <p>Dành cho công đoạn bọc ngoài — thứ làm việc SAU {@code next.proceed(...)}. Với chúng,
     * {@code AiStage.label()} nói sai vì chúng vào chuỗi ngay đầu lượt nhưng chỉ làm việc sau khi
     * model đã trả lời xong.
     *
     * <p>Nuốt mọi lỗi: báo tiến độ là phần thêm, còn câu trả lời mới là thứ người dùng cần. Công
     * đoạn gọi hàm này không phải tự phòng thủ.
     *
     * @param stage công đoạn đang báo — truyền {@code this}; tên lớp của nó thành mã sự kiện, giống
     *              hệt nhánh pipeline tự phát, để client đối chiếu được bằng một cách duy nhất
     */
    public void progress(AiStage stage, String label) {
        try {
            listener.stageStarted(stage.getClass().getSimpleName(), label);
        } catch (Exception ignore) {
            // Client ngắt giữa chừng là chuyện thường; lượt vẫn phải chạy nốt.
        }
    }
}
