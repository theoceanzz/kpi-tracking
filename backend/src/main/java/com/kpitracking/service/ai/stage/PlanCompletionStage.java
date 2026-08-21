package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.ChatMemoryCleaner;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.tool.ToolCallTracker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Đối chiếu tool đã lên KẾ HOẠCH với tool thực sự CHẠY; thiếu thì hỏi lại đúng một lần.
 *
 * <p><b>Vì sao có công đoạn này.</b> Đo trên bộ 40 câu hỏi với Cerebras: nhóm câu nhiều vế hỏng 7
 * lượt, trong đó <b>5 lượt model đã có đủ tool trong tay nhưng không gọi</b> — nó trả lời hai vế
 * đầu rồi bỏ vế cuối. Viết kế hoạch vào prompt là biện pháp mềm, model có thể phớt lờ; đây là
 * biện pháp cứng chạy ở backend, không phụ thuộc việc model có nghe lời hay không.
 *
 * <p>Chỉ soi các bước có nêu tên tool hợp lệ. Bước không rõ tool thì không có gì để đối chiếu,
 * và đoán bừa sẽ sinh ra lượt hỏi lại vô ích.
 *
 * <p><b>Hỏi lại tối đa MỘT lần</b>, dù còn thiếu bao nhiêu bước. Model đã bỏ qua hai lần thì lần
 * ba cũng vậy, trong khi mỗi lần hỏi lại là một lần gọi model có thật phải trả tiền.
 *
 * <p>Mặc định TẮT — bật riêng bằng {@code app.ai.planning.enforce} để đo phần lợi của việc hỏi lại
 * tách khỏi phần lợi của việc kế hoạch nêu tên tool.
 */
@Component
@Order(1050)
@Slf4j
public class PlanCompletionStage implements AiStage {

    private final boolean enabled;
    private final ChatMemoryCleaner chatMemoryCleaner;

    public PlanCompletionStage(@Value("${app.ai.planning.enforce:false}") boolean enabled,
                               ChatMemoryCleaner chatMemoryCleaner) {
        this.enabled = enabled;
        this.chatMemoryCleaner = chatMemoryCleaner;
    }

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        String answer = next.proceed(turn);
        if (!enabled) return answer;

        List<String> missing = missingTools(turn);
        if (missing.isEmpty()) return answer;

        log.info("Kế hoạch còn thiếu {} — hỏi lại một lần. question='{}'", missing, turn.getQuestion());
        // Báo ở ĐÂY chứ không qua label(): chỉ những lượt thật sự phải hỏi lại mới đáng nói, và
        // điều đó chỉ lộ ra sau khi model đã trả lời lượt đầu.
        turn.progress(this, "Đang bổ sung phần còn thiếu");

        // Advisor đã ghi câu hỏi + câu trả lời THIẾU của lượt đầu vào bộ nhớ. Không xoá thì hội
        // thoại đọng lại cùng câu hỏi hai lần kèm câu trả lời hỏng, và mọi lượt sau đều phải trả
        // tiền cho nó.
        chatMemoryCleaner.dropLastExchange(turn.memoryConversationId());

        turn.setMissingPlannedTools(missing);
        try {
            return next.proceed(turn);
        } catch (Exception e) {
            // Hỏi lại là phần THÊM. Lượt đầu đã có câu trả lời dùng được (chỉ thiếu một vế); để lỗi
            // của lượt hai nổi lên thì AiTurnPipeline biến cả lượt thành câu xin lỗi — tức cơ chế
            // sinh ra để cải thiện lại làm kết quả tệ đi.
            log.warn("Hỏi lại thất bại ({}), giữ câu trả lời của lượt đầu", e.getMessage());
            return answer;
        } finally {
            // Dọn để lần hỏi lại không rò sang nhánh khác của chuỗi (vd cửa thoát hiểm gọi lại
            // sau công đoạn này) và biến khối kế hoạch thành "CÒN THIẾU" ngoài ý muốn.
            turn.setMissingPlannedTools(null);
        }
    }

    /** Tool đã lên kế hoạch mà chưa lần nào chạy thành công trong lượt này. */
    private List<String> missingTools(AiTurn turn) {
        List<PlanStep> plan = turn.getPlan();
        if (plan == null || plan.isEmpty()) return List.of();

        List<String> called = ToolCallTracker.calls();
        return plan.stream()
                .filter(PlanStep::hasTool)
                .map(PlanStep::tool)
                .distinct()
                .filter(t -> !called.contains(t))
                .toList();
    }
    @Override
    public int getOrder() { return 1050; }
}
