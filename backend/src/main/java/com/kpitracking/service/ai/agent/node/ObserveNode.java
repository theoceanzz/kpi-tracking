package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.Node;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Model đã trả lời — quyết định hỏi lại hay dừng. Đây là đỉnh mang mọi CẠNH quay lui của đồ thị.
 *
 * <p><b>Đỉnh này thay hai công đoạn từng phải chạy lại cả phần chuỗi phía sau.</b> Trước đây
 * {@code EscapeHatchStage} và {@code PlanCompletionStage} đều gọi {@code next.proceed} thêm một lần
 * để làm đúng việc ở đây. Giá phải trả: định tuyến lại từ đầu, dựng lại prompt, bắn trùng sự kiện
 * tiến độ, và {@code PlanCompletionStage} còn phải xoá cặp hỏi-đáp vừa ghi vào bộ nhớ hội thoại —
 * dọn cho một thứ mà chính lần chạy lại ấy làm bẩn. Nay bộ nhớ chỉ ghi ở đỉnh FINISH nên không có
 * gì để dọn.
 *
 * <p><b>Thứ tự hai cạnh giữ y như thứ tự bọc cũ: bổ sung bước thiếu TRƯỚC, nới công cụ SAU.</b>
 * {@code EscapeHatchStage} ở lớp NGOÀI ({@code @Order} 1000) bọc quanh
 * {@code PlanCompletionStage} (1050), nên cái trong chạy trước. Đảo lại là đổi hành vi trên một bộ
 * đo đang xanh mà không có lý do nào.
 *
 * <p><b>Mỗi cạnh đi được đúng MỘT lần.</b> Model đã bỏ qua hai lần thì lần ba cũng vậy, trong khi
 * mỗi lần hỏi lại là một lần gọi model có thật phải trả tiền. Với đồ thị, đây còn là điều kiện dừng:
 * cạnh quay lui không nhớ mình đã đi qua thì chu trình chạy vô hạn.
 */
@Component
@Slf4j
public class ObserveNode implements Node {

    private final boolean planEnforce;

    public ObserveNode(@Value("${app.ai.planning.enforce:false}") boolean planEnforce) {
        this.planEnforce = planEnforce;
    }

    @Override
    public AgentNode id() {
        return AgentNode.OBSERVE;
    }

    @Override
    public AgentNode run(AgentState state) {
        AiTurn turn = state.getTurn();

        // Khối "CÒN THIẾU" chỉ thuộc về lần hỏi VỪA XONG. Xoá ngay để cạnh sau (nới công cụ) không
        // thừa hưởng nó và biến khối kế hoạch thành bản rút gọn ngoài ý muốn.
        turn.setMissingPlannedTools(null);

        // Hết ngân sách thì mọi cạnh quay lui đều vô nghĩa: hỏi lại cũng chỉ để hết ngân sách lần
        // nữa, mà lần này người dùng phải chờ gấp đôi.
        if (state.isBudgetExhausted()) return AgentNode.FINISH;

        // Đã có đề xuất điền form -> XONG, không cạnh quay lui nào được chạy nữa.
        //
        // <p><b>Thiếu cạnh này là nguồn gốc của ca S01 chập chờn.</b> Vốn từ của PlanNode cố ý KHÔNG
        // có tool điền form (xem KNOWN_TOOLS) — nó chỉ biết các tool tra cứu. Nên với một lượt điền
        // form, kế hoạch luôn nêu vài tool tra cứu chẳng liên quan, và phép đối chiếu bên dưới luôn
        // thấy "còn thiếu". Hệ quả đo được: model gọi đúng suggest_submission_form ngay lần đầu, rồi
        // bị bắt hỏi lại — lần hỏi hai VỨT câu trả lời đúng đó đi và tung xúc xắc lần nữa, có lần
        // model kể ra bảng đề xuất bằng lời thay vì gọi tool, và bản vá điền form mất trắng.
        //
        // <p>Đặt TRƯỚC phép đối chiếu kế hoạch chứ không phải sau: đây là điều kiện mạnh hơn hẳn.
        // Có bản vá trong tay nghĩa là việc người dùng nhờ đã xong, bất kể kế hoạch nói gì.
        if (state.getFormPatch() != null && !state.getFormPatch().isEmpty()) {
            return AgentNode.FINISH;
        }

        // Có hành động GHI chờ xác nhận -> DỪNG, cùng lý lẽ với bản vá điền form ngay trên.
        //
        // <p>Ở đây còn một lý do nữa, mạnh hơn: mọi cạnh quay lui đều XOÁ hội thoại rồi hỏi lại từ
        // đầu, nên model sẽ dựng một lời mời xác nhận THỨ HAI cho cùng một việc. Người dùng thấy
        // hai thẻ xác nhận cho một việc thì rất dễ bấm cả hai, và kho hành động chỉ chống được
        // bấm lặp trên CÙNG một khoá.
        if (state.getPendingAction() != null && !state.getPendingAction().isEmpty()) {
            return AgentNode.FINISH;
        }

        List<String> missing = missingTools(turn, state);
        if (planEnforce && !state.isPlanNudgeUsed() && !missing.isEmpty()) {
            state.setPlanNudgeUsed(true);
            log.info("Kế hoạch còn thiếu {} — hỏi lại một lần. question='{}'",
                    missing, turn.getQuestion());
            turn.progress(id().name(), "Đang bổ sung phần còn thiếu");
            turn.setMissingPlannedTools(missing);
            state.resetConversation();
            return AgentNode.MODEL;
        }

        if (state.escapeRequested() && !state.isEscapeUsed()) {
            state.setEscapeUsed(true);
            log.info("Mở rộng bộ công cụ và hỏi lại. Lý do model nêu: {}", state.getEscapeReason());
            turn.progress(id().name(), "Đang mở thêm công cụ");
            // Xoá lý do để tool need_other_tools ở lần hỏi sau lại nói được, mà không kéo thêm một
            // vòng nới nữa — cờ escapeUsed mới là thứ chốt số lần.
            state.setEscapeReason(null);
            state.setWidenTools(true);
            state.resetConversation();
            return AgentNode.ROUTE;
        }

        return AgentNode.FINISH;
    }

    /**
     * Tool đã lên kế hoạch mà chưa lần nào chạy thành công trong lượt này.
     *
     * <p>Chỉ soi các bước có nêu tên tool hợp lệ. Bước không rõ tool thì không có gì để đối chiếu,
     * và đoán bừa sẽ sinh ra lượt hỏi lại vô ích.
     *
     * <p><b>Vì sao có phép kiểm này.</b> Đo trên bộ 40 câu hỏi với Cerebras: nhóm câu nhiều vế hỏng
     * 7 lượt, trong đó <b>5 lượt model đã có đủ tool trong tay nhưng không gọi</b> — nó trả lời hai
     * vế đầu rồi bỏ vế cuối. Viết kế hoạch vào prompt là biện pháp mềm, model có thể phớt lờ; đây
     * là biện pháp cứng chạy ở backend, không phụ thuộc việc model có nghe lời hay không.
     */
    private static List<String> missingTools(AiTurn turn, AgentState state) {
        List<PlanStep> plan = turn.getPlan();
        if (plan == null || plan.isEmpty()) return List.of();

        List<String> called = state.getSucceeded();
        return plan.stream()
                .filter(PlanStep::hasTool)
                .map(PlanStep::tool)
                .distinct()
                .filter(t -> !called.contains(t))
                .toList();
    }
}
