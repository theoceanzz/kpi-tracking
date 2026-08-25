package com.kpitracking.service.ai.agent;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatch;
import lombok.Getter;
import lombok.Setter;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.chat.prompt.Prompt;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Trạng thái sống của một lần chạy agent (Blackboard).
 *
 * <p><b>Đây là thứ thay thế sáu kho ThreadLocal.</b> Trước đây tool muốn đưa dữ liệu ra ngoài vòng
 * lặp thì phải đi đường bên, vì Spring AI đưa chuỗi tool trả về cho MODEL đọc chứ không đưa cho ta.
 * Cách đó hỏng ÂM THẦM khi vòng lặp chạy trên luồng của reactor: kho ghi ở luồng kia là một ô nhớ
 * khác, nên bản đề xuất điền form không bao giờ về tới người dùng, câu hỏi gợi ý biến mất, cửa
 * thoát hiểm ngừng kích hoạt, và chốt chặn tên trùng chết. Phải dựng cả một tầng
 * {@code TurnStatePropagation} chỉ để mang THAM CHIẾU của hộp chứa qua luồng.
 *
 * <p>Nay trạng thái đi theo {@link ToolContext} — cùng một map mà Spring AI trao cho MỌI lời gọi
 * tool. Đây chính là cách {@code ToolProgress} vẫn làm và là lý do nó miễn nhiễm với cái bẫy đã
 * giết bốn kho kia. Không còn phụ thuộc vào việc ai đang chạy trên luồng nào, nên không còn gì để
 * truyền và cũng không còn gì để dọn.
 *
 * <p>Dùng cấu trúc an toàn đa luồng dù hiện tại vòng lặp chạy một luồng: giá phải trả gần bằng
 * không, mà nó chặn sẵn đúng lớp lỗi câm đã xảy ra một lần khi bật streaming.
 */
@Getter
public class AgentState {

    /** Khoá trong {@link ToolContext}. Đặt tên có tiền tố để không đụng khoá nghiệp vụ. */
    public static final String CONTEXT_KEY = "kpi.ai.agent-state";

    /**
     * Ngữ cảnh của lượt chat. {@code null} ở đường gợi ý KPI — đường đó không có lượt chat nào,
     * chỉ mượn tool, nên vẫn cần chỗ giữ trạng thái mà không có {@link AiTurn}.
     */
    private final AiTurn turn;

    /** Lịch sử hội thoại của vòng lặp, lớn dần sau mỗi vòng gọi tool. */
    private final List<Message> messages = new ArrayList<>();

    /** Các lời gọi tool model YÊU CẦU, ghi ngay khi yêu cầu chứ không đợi chúng trả về. */
    private final List<ToolCallRecord> requested = new CopyOnWriteArrayList<>();

    /**
     * Tên các tool CHẠY XONG và trả kết quả, theo thứ tự — thay {@code ToolCallTracker}.
     *
     * <p>Tách khỏi {@link #requested} là có chủ đích: tool lỗi đi qua {@code ToolSupport.toolError}
     * chứ không qua {@code respond}, nên nó có mặt ở danh sách yêu cầu mà KHÔNG có ở đây. Model thử
     * lấy dữ liệu, thất bại, rồi vẫn đưa ra con số thì đó chính là bịa — và công đoạn kiểm duyệt
     * phải bắt được.
     */
    private final List<String> succeeded = new CopyOnWriteArrayList<>();

    /** Các ID đang chờ người dùng chọn, theo loại thực thể — thay ThreadLocal của guard tên trùng. */
    private final Map<String, Set<UUID>> armed = new ConcurrentHashMap<>();

    /** Vòng lặp đang ở bước thứ mấy, đếm từ 1. */
    @Setter
    private int step;

    /** Câu trả lời cuối cùng, đặt khi model thôi gọi tool. */
    @Setter
    private String answer;

    /** Vòng lặp dừng vì hết ngân sách bước — để tầng trên trả lời trung thực. */
    @Setter
    private boolean budgetExhausted;

    /** Đề xuất điền form — thay {@code FormPatchStore}. */
    @Setter
    private FormPatch formPatch;

    /**
     * Hành động GHI đang chờ người dùng xác nhận.
     *
     * <p>Cùng vai trò với {@link #formPatch}, khác ở chỗ sau khi xác nhận thì BACKEND thực thi chứ
     * không phải giao diện điền vào form — mấy việc này (duyệt bài nộp, duyệt chỉ tiêu, nhắc nhở)
     * không có form nào trên màn hình.
     *
     * <p>Có giá trị ở đây nghĩa là vòng lặp phải DỪNG: xem {@code ObserveNode}.
     */
    @Setter
    private com.kpitracking.service.ai.action.PendingAction pendingAction;

    /** Model có xin mở vùng thả minh chứng không — thay ThreadLocal của {@code EvidenceRequestTool}. */
    @Setter
    private boolean evidenceRequested;

    /** Model có đính tệp đang ghim vào biểu mẫu không — thay ThreadLocal của {@code AttachFilesTool}. */
    @Setter
    private boolean filesAttached;

    /** Lý do model xin mở thêm công cụ; null nghĩa là không xin — thay {@code EscapeHatchTool}. */
    @Setter
    private String escapeReason;

    // ── phần dành riêng cho graph ────────────────────────────────────────────
    //
    // Bốn trường dưới đây là thứ thay cho việc CHẠY LẠI cả phần chuỗi phía sau. Bản trước, cửa
    // thoát hiểm và khâu bổ sung bước thiếu đều gọi {@code next.proceed} thêm một lần, nên "đã nới
    // rồi" và "đã nhắc rồi" không có chỗ nào ghi — chúng chỉ đúng nhờ mỗi công đoạn viết một câu
    // {@code if} chạy đúng một lần. Nay hai việc đó là CẠNH của graph, và cạnh thì phải nhớ được
    // mình đã đi qua chưa, nếu không đồ thị có chu trình sẽ quay vòng vô hạn.

    /** Đã nới bộ công cụ một lần rồi. Model xin lần hai thì thôi — xem {@code ObserveNode}. */
    @Setter
    private boolean escapeUsed;

    /** Đã nhắc bổ sung bước thiếu một lần rồi. */
    @Setter
    private boolean planNudgeUsed;

    /** {@code RouteNode} phải lấy TOÀN BỘ nhóm đọc thay vì hỏi lại router. */
    @Setter
    private boolean widenTools;

    /**
     * Lời gọi model gần nhất và câu hỏi sinh ra nó.
     *
     * <p>{@code ToolCallingManager.executeToolCalls} đòi ĐÚNG cặp prompt–response đó để dựng lại
     * lịch sử hội thoại; dựng lại prompt từ {@link #messages} sẽ ra một danh sách khác (thiếu
     * chính tin nhắn chứa lời gọi tool) và tool trả về sai chỗ. Hai trường này sống trong đúng
     * một vòng {@code MODEL → ACT}, không ai ngoài hai node đó đọc.
     */
    @Setter
    private Prompt lastPrompt;

    @Setter
    private ChatResponse lastResponse;

    public AgentState(AiTurn turn) {
        this.turn = turn;
    }

    /** Trạng thái cho đường chỉ mượn tool, không có lượt chat (gợi ý KPI). */
    public static AgentState forToolsOnly() {
        return new AgentState(null);
    }

    /**
     * Lấy trạng thái ra từ ngữ cảnh tool.
     *
     * <p>Trả {@code null} khi vắng, và mọi chỗ gọi phải chịu được điều đó: tool còn chạy ở test
     * dựng {@code ToolContext} trần. Vắng trạng thái nghĩa là không ghi được gì — chấp nhận được,
     * còn hơn ném lỗi giữa một lượt đang chạy.
     */
    public static AgentState from(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object value = context.getContext().get(CONTEXT_KEY);
        return value instanceof AgentState state ? state : null;
    }

    public void setMessages(List<Message> replacement) {
        messages.clear();
        messages.addAll(replacement);
    }

    /**
     * Bỏ hết hội thoại của lần hỏi vừa rồi để bắt đầu một lần hỏi MỚI.
     *
     * <p>Dùng ở hai cạnh quay lui của graph. Cả hai đều muốn hỏi lại từ đầu chứ không nói tiếp:
     * cửa thoát hiểm vì bộ công cụ đã khác, khâu bổ sung vì prompt lần này chỉ nêu phần còn thiếu.
     * Nối tiếp vào hội thoại cũ là bắt model đọc lại chính câu trả lời hỏng của nó.
     *
     * <p>Ngân sách bước cũng về 0: mỗi lần hỏi được trọn số vòng tự sửa lỗi của nó, đúng như bản
     * trước — ở đó mỗi lần {@code next.proceed} dựng một {@code AgentLoop.run} mới.
     */
    public void resetConversation() {
        messages.clear();
        answer = null;
        step = 0;
        lastPrompt = null;
        lastResponse = null;
    }

    public void recordRequest(ToolCallRecord call) {
        requested.add(call);
    }

    /** Ghi một tool đã chạy xong. Gọi từ {@code ToolSupport.respond} và {@code FormFillSupport.finish}. */
    public void recordSuccess(String toolName) {
        succeeded.add(toolName);
    }

    /** Có tool nào chạy xong không — thay {@code ToolCallTracker.anyCalled()}. */
    public boolean anyToolSucceeded() {
        return !succeeded.isEmpty();
    }

    /** Đánh dấu các ID mơ hồ đang chờ người dùng chọn. */
    public void arm(String entityType, Set<UUID> ids) {
        if (entityType == null || ids == null || ids.isEmpty()) return;
        armed.computeIfAbsent(entityType, k -> ConcurrentHashMap.newKeySet()).addAll(ids);
    }

    public boolean isArmed(String entityType, UUID id) {
        Set<UUID> ids = armed.get(entityType);
        return ids != null && ids.contains(id);
    }

    /** Model có xin mở thêm công cụ không. */
    public boolean escapeRequested() {
        return escapeReason != null;
    }

    /** Câu hỏi của lượt, hoặc mô tả thay thế khi không có lượt chat nào. */
    public String questionOrNa() {
        return turn == null ? "(không có lượt chat)" : turn.getQuestion();
    }
}
