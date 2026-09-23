package com.kpitracking.ai.workflow;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Chặn câu trả lời có số liệu mà không tool nào chạy — nghi model bịa.
 *
 * <p>Là {@code ValidationStage} cũ, giữ nguyên ba ngoại lệ đã đo được lý do:
 * <ul>
 *   <li>lượt đang mở form: model đọc số từ chính form, không cần tool;</li>
 *   <li>lượt có bộ nhớ hội thoại: số có thể đến từ câu trả lời trước;</li>
 *   <li>ngày tháng và số thứ tự đầu dòng không phải "số liệu".</li>
 * </ul>
 * Đây là cơ chế CHẶN: tắt đi thì model bịa số sẽ đến được người dùng.
 */
@Component
@Slf4j
public class AnswerValidator {

    /** Ngày tháng không phải "số liệu" — bỏ trước khi tìm chữ số. */
    private static final Pattern DATES = Pattern.compile(
            "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b|\\b\\d{1,2}[/-]\\d{4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b");

    /** Số thứ tự đầu dòng ("1.", "2)") là cách trình bày, không phải số liệu. */
    private static final Pattern LIST_MARKERS = Pattern.compile("(?m)^\\s*\\d+[.)]\\s");

    private static final Pattern ANY_DIGIT = Pattern.compile("\\d");

    static final String BLOCKED_ANSWER =
            "Xin lỗi, mình chưa lấy được dữ liệu cho yêu cầu này nên không thể đưa ra con số cụ thể. "
            + "Bạn thử hỏi rõ hơn về đơn vị hoặc kỳ KPI cần xem giúp mình nhé.";

    private final boolean enabled;

    public AnswerValidator(@Value("${app.ai.validation.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    /** @return câu trả lời giữ nguyên, hoặc câu chặn nếu nghi bịa số */
    public String check(AiTurn turn, String answer) {
        if (!enabled || answer == null) return answer;
        AgentState state = turn.getAgentState();
        List<String> called = state == null ? List.of() : state.getSucceeded();
        if (!called.isEmpty() || !hasFigures(answer)) return answer;
        if (turn.getOpenFormId() != null && !turn.getOpenFormId().isBlank()) {
            log.warn("Câu trả lời có số liệu và không tool nào chạy, nhưng lượt đang mở form '{}' "
                    + "nên KHÔNG chặn. question={}", turn.getOpenFormId(), turn.getQuestion());
            return answer;
        }
        if (turn.isHasMemory()) {
            log.warn("Câu trả lời có số liệu nhưng lượt này không gọi tool nào (có bộ nhớ hội thoại "
                    + "nên KHÔNG chặn). question={}", turn.getQuestion());
            return answer;
        }
        log.warn("CHẶN câu trả lời có số liệu mà không tool nào chạy — nghi bịa. question={} | answer={}",
                turn.getQuestion(), answer.length() > 200 ? answer.substring(0, 200) + "…" : answer);
        return BLOCKED_ANSWER;
    }

    /** Có số liệu thật không, sau khi đã loại ngày tháng và số thứ tự đầu dòng. */
    static boolean hasFigures(String answer) {
        String stripped = LIST_MARKERS.matcher(DATES.matcher(answer).replaceAll(" ")).replaceAll(" ");
        return ANY_DIGIT.matcher(stripped).find();
    }
}
