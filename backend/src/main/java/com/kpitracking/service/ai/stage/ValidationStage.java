package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;
import com.kpitracking.service.ai.agent.AgentState;
import java.util.List;

/**
 * Chặn câu trả lời đưa ra số liệu mà lượt đó KHÔNG lấy được dữ liệu nào từ tool.
 *
 * <p>Đứng trước {@code PlanningStage} nên nó bọc toàn bộ phần còn lại: gọi {@code next}, nhận câu
 * trả lời, rồi mới soi. Đây chính là dạng "chạy sau" mà khung được thiết kế để chèn.
 *
 * <p><b>Luật cố ý viết HẸP.</b> Không đối chiếu từng con số với JSON của tool, vì model tính ra số
 * dẫn xuất một cách chính đáng — phần trăm, tổng, trung bình, thứ hạng — và những số đó không xuất
 * hiện nguyên văn trong dữ liệu tool. Bắt hết sẽ báo nhầm chính các câu trả lời ĐÚNG, mà báo động
 * giả về bịa đặt còn tệ hơn không có: nó tập cho người ta bỏ qua cảnh báo thật.
 *
 * <p>Chỉ bắt một dấu hiệu gần như không thể nhầm: <b>có số liệu mà không tool nào chạy</b>.
 */
@Component
@Order(600)
@Slf4j
public class ValidationStage implements AiStage {

    /** Ngày tháng không phải "số liệu" — bỏ trước khi tìm chữ số. */
    private static final Pattern DATES = Pattern.compile(
            "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b|\\b\\d{1,2}[/-]\\d{4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b");

    /** Số thứ tự đầu dòng ("1.", "2)") là cách trình bày, không phải số liệu. */
    private static final Pattern LIST_MARKERS = Pattern.compile("(?m)^\\s*\\d+[.)]\\s");

    private static final Pattern ANY_DIGIT = Pattern.compile("\\d");

    private static final String BLOCKED_ANSWER =
            "Xin lỗi, mình chưa lấy được dữ liệu cho yêu cầu này nên không thể đưa ra con số cụ thể. "
            + "Bạn thử hỏi rõ hơn về đơn vị hoặc kỳ KPI cần xem giúp mình nhé.";

    private final boolean enabled;

    public ValidationStage(@Value("${app.ai.validation.enabled:false}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        String answer = next.proceed(turn);
        if (!enabled || answer == null) return answer;

        // Báo ở ĐÂY chứ không qua label(): công đoạn này vào chuỗi ngay đầu lượt nhưng chỉ soi câu
        // trả lời sau khi model đã trả lời xong.
        turn.progress(this, "Đang kiểm tra lại câu trả lời");

        // Ghi lại chuỗi tool của lượt để chẩn đoán về sau (trường dành sẵn từ lúc dựng khung).
        AgentState state = turn.getAgentState();
        List<String> called = state == null ? List.of() : state.getSucceeded();
        turn.setToolCallTrace(called);

        if (!called.isEmpty() || !hasFigures(answer)) return answer;

        // Lượt CÓ bộ nhớ: model được phép trả lời từ dữ liệu các lượt trước còn trong ngữ cảnh,
        // nên chặn ở đây là chặn nhầm. Chỉ ghi lại để theo dõi.
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
    private boolean hasFigures(String answer) {
        String stripped = LIST_MARKERS.matcher(DATES.matcher(answer).replaceAll(" ")).replaceAll(" ");
        return ANY_DIGIT.matcher(stripped).find();
    }
    @Override
    public int getOrder() { return 600; }
}
