package com.kpitracking.service.ai.agent;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatch;
import lombok.Getter;
import lombok.Setter;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ToolContext;

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

    /** Model có xin mở vùng thả minh chứng không — thay ThreadLocal của {@code EvidenceRequestTool}. */
    @Setter
    private boolean evidenceRequested;

    /** Model có đính tệp đang ghim vào biểu mẫu không — thay ThreadLocal của {@code AttachFilesTool}. */
    @Setter
    private boolean filesAttached;

    /** Lý do model xin mở thêm công cụ; null nghĩa là không xin — thay {@code EscapeHatchTool}. */
    @Setter
    private String escapeReason;

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
