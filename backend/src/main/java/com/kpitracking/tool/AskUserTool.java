package com.kpitracking.tool;

import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.hitl.PendingQuestion;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.AskUserRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hỏi người dùng một câu GIỮA LƯỢT rồi chờ trả lời (human-in-the-loop).
 *
 * <p>Trước đây trợ lý chỉ hỏi được bằng cách kết thúc lượt: viết câu hỏi ra màn hình, người dùng gõ
 * lại, hệ thống chạy lượt mới từ đầu — mất hết ngữ cảnh đã tra được. Tool này giữ lượt sống: model
 * dừng, người dùng bấm một lựa chọn, model làm tiếp với đúng dữ liệu đang có.
 *
 * <p>Không tự làm việc gì: nó chỉ ĐẶT câu hỏi vào {@code AgentState}. Bước chờ nằm trong đồ thị
 * ({@code TurnSteps.awaitUserAnswer}) vì chỉ ở đó mới biết lượt này có kênh nào để hỏi (SSE) hay
 * không (đường JSON).
 */
@Component
@RequiredArgsConstructor
public class AskUserTool {

    /** Nhiều hơn năm lựa chọn thì người dùng phải đọc như đọc danh sách — lúc đó hãy hỏi mở. */
    private static final int MAX_OPTIONS = 5;

    /**
     * Câu hỏi VỀ CHÍNH NGƯỜI HỎI — đơn vị của họ, quyền của họ.
     *
     * <p>Hệ thống đã biết cả hai từ trước khi lượt bắt đầu, nên hỏi lại là vô nghĩa. Nó còn là một
     * đường lách: đo được ở D11/D15, người dùng hỏi về đơn vị NGOÀI phạm vi thì model né câu từ chối
     * bằng cách hỏi ngược "bạn thuộc đơn vị nào?" — người dùng đọc xong không hề biết mình bị chặn.
     */
    private static final java.util.regex.Pattern ABOUT_THE_ASKER = java.util.regex.Pattern.compile(
            "(có quyền|được phép|bạn thuộc đơn vị|đơn vị của (bạn|tôi|mình)|đơn vị hiện tại)",
            // UNICODE_CASE là BẮT BUỘC: thiếu nó, CASE_INSENSITIVE của Java chỉ đổi hoa-thường cho
            // chữ ASCII, nên "Đơn vị hiện tại của tôi" không khớp "đơn vị hiện tại" (đo được ở D11).
            java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE);

    private final ToolSupport support;

    @Tool(name = "ask_user", value =
            "HỎI NGƯỜI DÙNG rồi CHỜ họ trả lời, trong cùng lượt này. CHỈ gọi SAU KHI đã tra (search / "
            + "get_org_unit / get_people…) và biết có những khả năng nào — gọi trước khi tra sẽ bị từ chối. "
            + "Dùng mỗi khi cần một thông tin mà chỉ người dùng mới có (tên trùng nhiều bản, câu hỏi nhiều "
            + "cách hiểu, chọn đơn vị/kỳ/mức mục tiêu…) — thay vì viết câu hỏi ra câu trả lời. "
            + "Một câu: question + options (tuỳ chọn, tối đa 5; mỗi lựa chọn có label và tuỳ chọn description) "
            + "+ multiSelect=true khi người dùng được chọn NHIỀU (vd chọn các đơn vị cần so sánh). "
            + "Vài câu cùng lúc: questions=[{question, options, multiSelect}] tối đa 3 — hỏi gộp một lần. "
            + "Người dùng luôn tự nhập được ngoài các lựa chọn; biết các khả năng thì TRA TRƯỚC (search / "
            + "get_org_unit / get_people) rồi đưa thành options. "
            + "KHÔNG dùng để hỏi thứ mình tra được bằng tool khác, không xin phép làm việc (thao tác ghi đã có "
            + "lời mời xác nhận riêng), KHÔNG hỏi về quyền hay phạm vi của người hỏi — hệ thống tự trả lời "
            + "được hay không. Người dùng đã nêu RÕ một cái tên thì cứ GỌI TOOL với tên đó. "
            + "Sau khi gọi tool này hãy DỪNG NGAY: không gọi thêm tool, không viết câu trả lời — hệ "
            + "thống sẽ gọi lại bạn kèm câu trả lời của người dùng.")
    public String askUser(AskUserRequest request, InvocationParameters context) {
        try {
            List<PendingQuestion.Item> items = itemsOf(request);
            if (items.isEmpty()) {
                throw new IllegalArgumentException("Cần question (hoặc questions) — câu hỏi viết cho người dùng đọc.");
            }
            AgentState state = AgentState.from(context);
            if (state == null || state.getTurn() == null) {
                throw new IllegalStateException("Lượt này không hỏi lại được; hãy trả lời bằng dữ liệu đang có.");
            }
            // CHƯA tra gì mà đã hỏi: đo được ở D11/D12/D15 — model ngờ câu hỏi nằm ngoài phạm vi rồi
            // hỏi ngược người dùng ("bạn có quyền xem đơn vị này không?") thay vì gọi tool và nhận câu
            // từ chối rõ ràng. Lời dặn trong mô tả tool không đủ; đây là chốt chặn.
            if (!state.anyToolSucceeded()) {
                throw new IllegalStateException("Chưa tra gì nên chưa hỏi được. Bước tiếp: gọi search (hoặc "
                        + "get_org_unit / get_people) để lấy các khả năng có thật, RỒI gọi lại ask_user với "
                        + "chúng làm options. Người dùng đã nêu rõ tên thì cứ gọi tool với tên đó — ngoài phạm "
                        + "vi thì hệ thống sẽ nói rõ.");
            }
            // Hệ thống đã từ chối vì ngoài phạm vi: nói lại lời từ chối, không hỏi vòng.
            if (state.isScopeDenied()) {
                throw new IllegalStateException("Yêu cầu này đã bị từ chối vì đơn vị nằm ngoài phạm vi "
                        + "của người hỏi. Nói lại điều đó cho họ (họ chỉ xem/thao tác được đơn vị của "
                        + "mình và đơn vị con); KHÔNG hỏi lại.");
            }
            // Thứ người dùng nêu KHÔNG CÓ trong dữ liệu: nói thẳng, đừng hỏi "bạn muốn cái nào?".
            if (state.getNotFoundName() != null) {
                throw new IllegalStateException("'" + state.getNotFoundName() + "' không có trong dữ liệu. "
                        + "Trả lời thẳng là không tồn tại và nêu các mục có thật; KHÔNG hỏi lại.");
            }
            // MỘT lượt hỏi MỘT lần. Đo được 23/09: người dùng trả lời xong, vòng sau model hỏi lại đúng
            // câu cũ, rồi người dùng bỏ qua và lượt kết thúc trắng tay sau 53 giây.
            if (state.getTurn().getAnsweredQuestion() != null) {
                throw new IllegalStateException("Đã hỏi người dùng một lần trong lượt này và họ trả lời: '"
                        + state.getTurn().getAnsweredValue() + "'. Làm tiếp với câu trả lời đó; nếu nó "
                        + "không khớp gì trong dữ liệu thì nói thẳng là không có, KHÔNG hỏi lại.");
            }
            StringBuilder haystack = new StringBuilder();
            for (PendingQuestion.Item it : items) {
                haystack.append(it.question()).append(' ');
                for (PendingQuestion.Option o : it.options()) {
                    haystack.append(o.label()).append(' ').append(o.description() == null ? "" : o.description()).append(' ');
                }
            }
            if (ABOUT_THE_ASKER.matcher(haystack).find()) {
                throw new IllegalStateException("Không hỏi người dùng về quyền hay đơn vị của chính họ — "
                        + "hệ thống đã biết cả hai. Hãy GỌI TOOL với đúng cái tên người dùng đã nêu: "
                        + "nằm ngoài phạm vi thì hệ thống trả câu từ chối, và việc của bạn là nói lại "
                        + "điều đó cho họ, không phải hỏi vòng.");
            }
            // Tool khác trong cùng vòng đã đặt câu hỏi rồi (vd compare_org_units gặp tên trùng):
            // giữ câu hỏi ĐÓ, vì nó kèm sẵn danh sách lựa chọn lấy từ dữ liệu thật. Ghi đè bằng một
            // câu hỏi trống là bắt người dùng tự gõ lại tên mà hệ thống vừa tra được (đo được ở H02).
            if (state.getPendingQuestion() != null) {
                return support.respond(context, "ask_user", Map.of(
                        "asked", true,
                        "message", "Một câu hỏi kèm lựa chọn đã được gửi tới người dùng ở bước trước. "
                                + "DỪNG tại đây — không hỏi lại, không gọi thêm tool."));
            }
            state.setPendingQuestion(new PendingQuestion(
                    UUID.randomUUID().toString(), state.getTurn().getTurnId(),
                    support.getUserId(context), items));

            return support.respond(context, "ask_user", Map.of(
                    "asked", true,
                    "message", "Đã gửi câu hỏi tới người dùng. DỪNG tại đây — không gọi thêm tool, không "
                            + "viết câu trả lời; hệ thống sẽ gọi lại bạn kèm lựa chọn của họ."));
        } catch (Exception e) {
            return support.toolError("ask_user", e);
        }
    }

    /**
     * Gom hai dạng gọi về một danh sách câu hỏi: dạng một câu ({@code question/options/multiSelect})
     * và dạng nhiều câu ({@code questions}). Câu trống bị bỏ; trần 3 câu, 5 lựa chọn mỗi câu.
     */
    static List<PendingQuestion.Item> itemsOf(AskUserRequest request) {
        List<PendingQuestion.Item> items = new ArrayList<>();
        if (request == null) return items;
        if (request.questions() != null) {
            for (AskUserRequest.Question q : request.questions()) {
                if (q == null || !ToolSupport.notBlank(q.question())) continue;
                if (items.size() >= PendingQuestion.MAX_ITEMS) break;
                items.add(new PendingQuestion.Item(q.question().strip(), optionsOf(q.options()),
                        Boolean.TRUE.equals(q.multiSelect())));
            }
        }
        if (items.isEmpty() && ToolSupport.notBlank(request.question())) {
            items.add(new PendingQuestion.Item(request.question().strip(), optionsOf(request.options()),
                    Boolean.TRUE.equals(request.multiSelect())));
        }
        return items;
    }

    private static List<PendingQuestion.Option> optionsOf(List<AskUserRequest.Choice> choices) {
        List<PendingQuestion.Option> options = new ArrayList<>();
        if (choices == null) return options;
        for (AskUserRequest.Choice c : choices) {
            if (c == null || !ToolSupport.notBlank(c.label())) continue;
            if (options.size() >= MAX_OPTIONS) break;
            String value = ToolSupport.notBlank(c.value()) ? c.value().trim() : c.label().trim();
            options.add(new PendingQuestion.Option(value, c.label().trim(), c.description()));
        }
        return options;
    }
}
