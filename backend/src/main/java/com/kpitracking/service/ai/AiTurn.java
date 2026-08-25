package com.kpitracking.service.ai;

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
    /** Ô đang hiện/sửa được trên màn hình. Chỉ thu hẹp — xem ghi chú ở {@code AiChatRequest}. */
    private List<String> openFormFields;
    /** Form đang mở có mục nhận tệp không. Không có thì trợ lý không được mời gửi tệp. */
    private boolean openFormAcceptsFiles;
    /**
     * Tên các tệp minh chứng người dùng kẹp vào ô chat ở lượt này. Chỉ tên: nội dung tệp ở lại
     * trình duyệt, đi thẳng sang biểu mẫu báo cáo. Trợ lý không đọc được tệp, chỉ biết là có.
     */
    private List<String> attachmentNames;
    /** Tên tệp người dùng đang GHIM ở ô chat — ứng viên để đính. */
    private List<String> pinnedFileNames;

    // ── dựng dần qua từng stage ──────────────────────────────────────────────
    private ManagerContext manager;
    private UUID effectiveUnitId;
    private Map<String, Object> toolCtx = new HashMap<>();
    private String currentDateTime;
    private boolean hasMemory;

    /** Bộ tool thực sự trao cho model = nhóm ∩ quyền của người dùng. */
    private List<Object> tools;
    /**
     * Nhóm câu hỏi cần tới nhưng người dùng KHÔNG có quyền, do {@code RouteNode} ghi.
     *
     * <p>Rỗng ở gần như mọi lượt. Có giá trị thì {@code TurnPromptBuilder} nói thẳng cho model biết
     * nó thiếu đúng khả năng nào — thiếu vế đó, model đi tìm dữ liệu gần giống để thế vào và gắn
     * nhãn của thứ nó không lấy được.
     */
    private Set<ToolRegistry.Group> deniedGroups;

    // ── chỗ dành sẵn cho các công đoạn sắp thêm ──────────────────────────────
    /** Kế hoạch nhiều bước, do {@code PlanNode} lập. Rỗng/null = lượt này không dùng kế hoạch. */
    private List<PlanStep> plan;
    /**
     * Đề xuất điền form mà tool sinh ra trong lượt này.
     *
     * <p>Pipeline chép nó từ {@code AgentState} sang đây ở khối {@code finally}, để tầng gọi chỉ
     * cần đọc {@code AiTurn} mà không phải biết gì về trạng thái bên trong vòng lặp.
     */
    private FormPatch formPatch;
    /**
     * Hành động GHI chờ xác nhận mà tool sinh ra trong lượt này. Pipeline chép từ {@code AgentState}
     * sang đây ở khối {@code finally}, cùng lý do với {@link #formPatch}.
     */
    private com.kpitracking.service.ai.action.PendingAction pendingAction;
    /**
     * Tên đơn vị của thẻ Insight người dùng bấm, nếu có. {@code TurnSetupStage} gắn khi nó đã nạp
     * đơn vị để kiểm {@code focusUnitId} — không tốn thêm truy vấn nào.
     */
    private String focusUnitName;
    /** Các câu hỏi gợi ý tiếp theo do {@code FollowupStage} sinh; null ở lượt không có gợi ý. */
    private FollowupResponse followups;
    /**
     * Lượt này model có xin mở vùng thả minh chứng trong khung chat không.
     *
     * <p>Pipeline chép nó từ {@code AgentState} sang đây, cùng lý do với {@code formPatch}.
     */
    private boolean evidenceRequested;
    /** Lượt này model có đính tệp đang ghim vào biểu mẫu không. */
    private boolean filesAttached;

    /**
     * Nơi nhận tiến độ của lượt. Mặc định {@link TurnListener#NOOP} nên đường JSON không phải biết
     * gì về streaming, và pipeline không phải kiểm null ở mỗi chỗ phát.
     */
    private TurnListener listener = TurnListener.NOOP;
    /**
     * Các tool đã lên kế hoạch nhưng lần hỏi đầu không gọi — do {@code ObserveNode} đặt trước khi
     * cho quay lại đỉnh MODEL, để khối kế hoạch lần hai chỉ nêu đúng phần còn thiếu thay vì nhắc
     * lại cả kế hoạch.
     */
    private List<String> missingPlannedTools;

    /**
     * Trạng thái của vòng lặp agent trong lượt này — lịch sử hội thoại, các tool đã gọi, bước
     * thứ mấy. Do {@code TurnSetupStage} tạo, {@code AgentStage} chạy đồ thị trên đó.
     *
     * <p>Các công đoạn bọc ngoài đọc trace ở đây thay vì móc từ ThreadLocal: trạng thái đã là giá
     * trị truyền tường minh nên không còn phụ thuộc vào việc tool chạy trên luồng nào.
     */
    private com.kpitracking.service.ai.agent.AgentState agentState;

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
        progress(stage.getClass().getSimpleName(), label);
    }

    /**
     * Cùng việc như trên, cho những thứ KHÔNG phải {@link AiStage} — các đỉnh của đồ thị agent.
     *
     * <p>Node không có tên lớp nào đáng đưa ra client (chúng là chi tiết bên trong một công đoạn
     * duy nhất), nên chúng tự khai mã. Client vốn chỉ đọc nhãn; mã dành cho việc đối chiếu nhật ký.
     */
    public void progress(String code, String label) {
        try {
            listener.stageStarted(code, label);
        } catch (Exception ignore) {
            // Client ngắt giữa chừng là chuyện thường; lượt vẫn phải chạy nốt.
        }
    }
}
