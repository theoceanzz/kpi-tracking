package com.kpitracking.service.ai.agent;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatch;
import lombok.Getter;
import lombok.Setter;
import dev.langchain4j.invocation.InvocationParameters;

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
 * lặp thì phải đi đường bên, vì kết quả tool được đưa cho MODEL đọc chứ không đưa cho ta.
 * Cách đó hỏng ÂM THẦM khi vòng lặp chạy trên luồng của reactor: kho ghi ở luồng kia là một ô nhớ
 * khác, nên bản đề xuất điền form không bao giờ về tới người dùng, câu hỏi gợi ý biến mất, cửa
 * thoát hiểm ngừng kích hoạt, và chốt chặn tên trùng chết. Phải dựng cả một tầng
 * {@code TurnStatePropagation} chỉ để mang THAM CHIẾU của hộp chứa qua luồng.
 *
 * <p>Nay trạng thái đi theo {@link InvocationParameters} — cùng một bộ tham số mà langchain4j trao cho MỌI lời gọi
 * tool. Đây chính là cách {@code ToolProgress} vẫn làm và là lý do nó miễn nhiễm với cái bẫy đã
 * giết bốn kho kia. Không còn phụ thuộc vào việc ai đang chạy trên luồng nào, nên không còn gì để
 * truyền và cũng không còn gì để dọn.
 *
 * <p>Dùng cấu trúc an toàn đa luồng dù hiện tại vòng lặp chạy một luồng: giá phải trả gần bằng
 * không, mà nó chặn sẵn đúng lớp lỗi câm đã xảy ra một lần khi bật streaming.
 */
@Getter
public class AgentState {

    /** Khoá trong {@link InvocationParameters}. Đặt tên có tiền tố để không đụng khoá nghiệp vụ. */
    public static final String CONTEXT_KEY = "kpi.ai.agent-state";

    /**
     * Ngữ cảnh của lượt chat. {@code null} ở đường gợi ý KPI — đường đó không có lượt chat nào,
     * chỉ mượn tool, nên vẫn cần chỗ giữ trạng thái mà không có {@link AiTurn}.
     */
    private final AiTurn turn;



    /**
     * Tên các tool CHẠY XONG và trả kết quả, theo thứ tự — thay {@code ToolCallTracker}.
     *
     * <p>Tách khỏi {@link #requested} là có chủ đích: tool lỗi đi qua {@code ToolSupport.toolError}
     * chứ không qua {@code respond}, nên nó có mặt ở danh sách yêu cầu mà KHÔNG có ở đây. Model thử
     * lấy dữ liệu, thất bại, rồi vẫn đưa ra con số thì đó chính là bịa — và công đoạn kiểm duyệt
     * phải bắt được.
     */
    private final List<String> succeeded = new CopyOnWriteArrayList<>();

    /**
     * Kết quả JSON của các tool đã chạy TRONG LƯỢT NÀY — nguồn duy nhất để dựng biểu đồ.
     *
     * <p>Khác {@code FollowupContextStore} (gom theo HỘI THOẠI, sống 30 phút, để trả lời câu hỏi nối
     * tiếp): ở đây phải là đúng số của lượt đang trả lời, nếu không biểu đồ sẽ vẽ số của câu hỏi
     * trước. Cắt bớt vì payload lớn không dùng để vẽ mà chỉ làm phình prompt.
     */
    private final List<ToolPayload> payloads = new CopyOnWriteArrayList<>();

    private static final int MAX_PAYLOADS = 12;
    private static final int MAX_PAYLOAD_CHARS = 8_000;

    /** Một kết quả tool: tên và JSON nguyên văn. */
    public record ToolPayload(String tool, String json) {}

    /**
     * Kết quả tool của lượt TRƯỚC trong cùng hội thoại, chép ra trước khi {@code startTurn} xoá.
     * Chỉ dùng cho một việc: người dùng nối tiếp "cho tôi biểu đồ tròn đi" — lượt đó không gọi tool
     * nào, số liệu nằm ở lượt trước. KHÔNG dùng cho kiểm duyệt câu trả lời.
     */
    @Setter
    private List<ToolPayload> priorPayloads = List.of();

    /**
     * Cái tên người dùng nêu mà tra không ra gì ở lượt này (vd "phòng vận hành"), hoặc {@code null}.
     * Khi đã biết là KHÔNG CÓ thì câu trả lời đúng là nói thẳng như vậy — {@code ask_user} bị chặn,
     * vì hỏi "bạn muốn đơn vị nào?" với một tiền đề sai là đẩy người dùng vào vòng hỏi-đáp vô ích
     * (đo được 23/09, H04). Tra lại mà ra kết quả thì xoá.
     */
    @Setter
    private String notFoundName;

    /**
     * Một tool ở lượt này đã bị từ chối vì đơn vị nằm NGOÀI phạm vi người hỏi. Từ lúc đó câu trả
     * lời đúng là nói lại lời từ chối — {@code ask_user} bị chặn (đo được ở D15: bị từ chối xong
     * model tra thêm một lần rồi hỏi ngược "bạn muốn chốt cho đơn vị nào?").
     */
    @Setter
    private boolean scopeDenied;

    /** Các ID đang chờ người dùng chọn, theo loại thực thể — thay ThreadLocal của guard tên trùng. */
    private final Map<String, Set<UUID>> armed = new ConcurrentHashMap<>();

    /**
     * Tài liệu của tổ chức mà lượt này đã đọc (nhánh hỏi đáp + công cụ {@code get_org_documents}), mỗi tài liệu
     * một lần, theo thứ tự gặp. Client vẽ thành chip nguồn. Chỉ gồm đoạn đã qua bộ lọc quyền của người hỏi.
     */
    private final List<com.kpitracking.dto.response.ai.DocumentSourceResponse> sources = new CopyOnWriteArrayList<>();

    /** Tối đa bấy nhiêu chip — nhiều hơn là nhiễu, model cũng không dùng hết. */
    private static final int MAX_SOURCES = 6;

    /** Thêm nguồn, bỏ trùng theo {@code docId}. */
    public synchronized void addSources(java.util.Collection<com.kpitracking.dto.response.ai.DocumentSourceResponse> found) {
        if (found == null) return;
        for (var s : found) {
            if (s == null || sources.size() >= MAX_SOURCES) continue;
            if (sources.stream().noneMatch(x -> x.docId().equals(s.docId()))) sources.add(s);
        }
    }

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
     * Ghi chú phạm vi cho lời gọi tool ĐANG chạy: người dùng nói "công ty / toàn tổ chức / đơn vị tôi"
     * và {@code ToolSupport.resolveUnit} đã quy về đơn vị hiệu lực. {@code respond} nhặt và xoá — nhờ
     * vậy model biết số liệu là của đơn vị nào thay vì gọi bừa là "công ty".
     */
    @Setter
    private String scopeNote;

    /**
     * Hành động GHI đang chờ người dùng xác nhận.
     *
     * <p>Cùng vai trò với {@link #formPatch}, khác ở chỗ sau khi xác nhận thì BACKEND thực thi chứ
     * không phải giao diện điền vào form — mấy việc này (duyệt bài nộp, duyệt chỉ tiêu, nhắc nhở)
     * không có form nào trên màn hình.
     *
     * <p>Có giá trị ở đây nghĩa là vòng lặp phải DỪNG: xem {@code TurnSteps.needsAnotherRound}.
     */
    @Setter
    private com.kpitracking.service.ai.action.PendingAction pendingAction;

    /**
     * Id của lời mời vừa được CHẠY trong lượt này (xác nhận bằng chat).
     *
     * <p>Client cần biết để tắt cái thẻ xác nhận cũ vẫn còn nằm trên màn hình. Không có tín hiệu
     * này thì người dùng xác nhận bằng chat xong vẫn thấy nút, bấm vào lại nhận "lời mời không còn
     * hiệu lực" — đúng về mặt an toàn nhưng nhìn như hỏng.
     */
    @Setter
    private String consumedActionId;

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

    /** Đã nới bộ công cụ một lần rồi. Model xin lần hai thì thôi — xem {@code TurnSteps.needsAnotherRound}. */
    @Setter
    private boolean escapeUsed;

    /** Đã nhắc bổ sung bước thiếu một lần rồi. */
    @Setter
    private boolean planNudgeUsed;

    /** {@code TurnSteps.route} phải lấy TOÀN BỘ nhóm đọc thay vì hỏi lại router. */
    @Setter
    private boolean widenTools;

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
     * dựng {@code InvocationParameters} trần. Vắng trạng thái nghĩa là không ghi được gì — chấp nhận được,
     * còn hơn ném lỗi giữa một lượt đang chạy.
     */
    public static AgentState from(InvocationParameters context) {
        if (context == null) return null;
        Object value = context.get(CONTEXT_KEY);
        return value instanceof AgentState state ? state : null;
    }




    /** Ghi một tool đã chạy xong. Gọi từ {@code ToolSupport.respond} và {@code FormFillSupport.finish}. */
    public void recordSuccess(String toolName) {
        succeeded.add(toolName);
    }

    /**
     * Câu hỏi tool vừa đặt cho người dùng và lượt đang chờ trả lời (human-in-the-loop). Bước
     * {@code TurnSteps.awaitUserAnswer} nhặt rồi xoá.
     */
    @Setter
    private com.kpitracking.service.ai.hitl.PendingQuestion pendingQuestion;

    /** Câu người dùng vừa trả lời cho {@link #pendingQuestion}; {@code null} = chưa/không trả lời. */
    @Setter
    private String userAnswer;

    /** Bỏ mọi chốt chặn tên trùng — gọi sau khi người dùng đã chọn rõ, để vòng sau không hỏi lại. */
    public void disarmAll() {
        armed.clear();
    }

    /** Ghi kết quả JSON của một tool để bước dựng biểu đồ đọc lại. Payload quá dài thì cắt. */
    public void recordPayload(String toolName, String json) {
        if (json == null || payloads.size() >= MAX_PAYLOADS) return;
        payloads.add(new ToolPayload(toolName,
                json.length() > MAX_PAYLOAD_CHARS ? json.substring(0, MAX_PAYLOAD_CHARS) : json));
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
