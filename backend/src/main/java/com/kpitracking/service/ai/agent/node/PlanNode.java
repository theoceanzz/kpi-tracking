package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.Node;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Chia câu hỏi thành các bước con TRƯỚC khi định tuyến và gọi model.
 *
 * <p><b>Vì sao có đỉnh này.</b> Đo trên bộ 40 câu hỏi: ở nhóm câu cần nhiều tool, model được trao
 * đủ công cụ nhưng <b>bỏ sót lời gọi ở 11/15 câu hỏng</b> — nó hiểu việc nhưng nhảy cóc, trả lời
 * sau bước đầu tiên. Chỉ 2/15 là lỗi sinh JSON, thứ mà lập kế hoạch không chữa được. Viết ra các
 * bước tường minh nhắm đúng loại lỗi chiếm đa số đó.
 *
 * <p><b>Không bao giờ được làm hỏng lượt.</b> Lập kế hoạch lỗi, trả rác, hay chỉ ra một bước thì bỏ
 * qua kế hoạch và chạy y như khi tắt — cùng kỷ luật với
 * {@link com.kpitracking.service.ai.intent.IntentStrategy}: mọi trường hợp không chắc đều lùi về
 * hành vi cũ.
 *
 * <p><b>Đứng trước {@code RouteNode}</b> vì kế hoạch nêu đích danh tool, và đỉnh định tuyến HỢP các
 * nhóm đó vào nhóm router tự chọn. Đảo thứ tự là mất phần hợp ấy — xem {@link AgentNode}.
 *
 * <p>Tốn thêm một lần gọi model cho mỗi câu hỏi, nên phải đo thấy nhóm B/C tăng tương xứng rồi mới
 * bật ({@code app.ai.planning.enabled}).
 */
@Component
@Slf4j
public class PlanNode implements Node {

    /**
     * Vốn từ của khâu lập kế hoạch. KHÔNG có {@code need_other_tools} — đó là cửa thoát hiểm,
     * không phải một bước lấy dữ liệu, nêu nó vào kế hoạch chỉ tổ dụ model gọi lung tung.
     */
    private static final Set<String> KNOWN_TOOLS = Set.of(
            "search", "get_org_unit", "get_people", "get_kpi",
            "get_submissions", "rank", "compare_org_units", "get_analytics");

    private static final String PROMPT = """
            Chia câu hỏi sau thành các bước lấy dữ liệu, mỗi bước một dòng, tối đa 4 bước.

            Mỗi dòng viết đúng dạng:  TÊN_TOOL | việc cần lấy

            Chỉ được dùng các TÊN_TOOL sau:
            search           - tìm đơn vị/người/KPI theo tên khi chưa biết chính xác
            get_org_unit     - thông tin đơn vị, cây đơn vị, đơn vị con
            get_people       - danh sách người, chức vụ, hồ sơ cá nhân
            get_kpi          - chỉ tiêu KPI, kỳ đánh giá, ai được giao, tổng quan KPI của đơn vị
            get_submissions  - bài nộp, lịch sử nộp, ai chưa nộp
            rank             - xếp hạng người hoặc đơn vị
            compare_org_units- so sánh các đơn vị theo hiệu suất, tiến độ, quân số, tỉ lệ hoàn thành.
                               KHÔNG có chỉ số rủi ro — câu hỏi về rủi ro phải dùng get_analytics
            get_analytics    - bức tranh toàn đơn vị (quân số + số đơn vị con + số kỳ),
                               xu hướng qua các kỳ, và KPI rủi ro/trễ hạn

            Quy tắc:
            - Mỗi VẾ của câu hỏi là MỘT bước. Câu hỏi có 3 vế thì phải có 3 bước.
            - Chỉ tách bước khi câu hỏi thật sự cần nhiều loại dữ liệu khác nhau.
            - Câu hỏi đơn giản chỉ cần MỘT bước.
            - Không giải thích, không đánh số, không thêm chữ nào khác.

            Câu hỏi: {question}
            """;

    /** Trần số bước; dài hơn thì gần như chắc chắn model đang lan man. */
    private static final int MAX_STEPS = 4;

    private final ChatClient chatClient;
    private final boolean enabled;

    public PlanNode(@Qualifier("openAiChatClient") ChatClient chatClient,
                    @Value("${app.ai.planning.enabled:false}") boolean enabled) {
        this.chatClient = chatClient;
        this.enabled = enabled;
    }

    @Override
    public AgentNode id() {
        return AgentNode.PLAN;
    }

    @Override
    public AgentNode run(AgentState state) {
        AiTurn turn = state.getTurn();
        if (!enabled) {
            // Báo nhãn CHỈ KHI thật sự lập kế hoạch. Bản trước để pipeline phát nhãn lúc vào công
            // đoạn, nên tắt kế hoạch mà người dùng vẫn đọc thấy "Đang lập kế hoạch trả lời" —
            // một câu không đúng sự thật.
            return AgentNode.ROUTE;
        }
        turn.progress(id().name(), "Đang lập kế hoạch trả lời");

        List<PlanStep> steps = plan(turn.getQuestion());
        // Một bước nghĩa là câu hỏi đơn giản — viết kế hoạch ra chỉ tốn token mà không thêm thông
        // tin gì cho model.
        if (steps.size() > 1) {
            turn.setPlan(steps);
            // Ghi cả NỘI DUNG bước, không chỉ số lượng: thiếu nó thì không thể biết kế hoạch sai ở
            // đâu khi đo, và đó chính là chỗ đã mù khi truy nguyên nhóm C.
            log.debug("Kế hoạch {} bước cho '{}': {}", steps.size(), turn.getQuestion(),
                    steps.stream().map(PlanStep::describe).toList());
        }
        return AgentNode.ROUTE;
    }

    /** Trả danh sách bước; danh sách rỗng nghĩa là không dùng kế hoạch cho lượt này. */
    List<PlanStep> plan(String question) {
        try {
            String raw = chatClient.prompt()
                    .user(PROMPT.replace("{question}", question))
                    .call()
                    .content();
            return parse(raw);
        } catch (Exception e) {
            // Lập kế hoạch hỏng thì lượt hỏi vẫn phải chạy được như bình thường.
            log.warn("Lập kế hoạch lỗi ({}), bỏ qua kế hoạch cho lượt này", e.getMessage());
            return List.of();
        }
    }

    /**
     * Bóc "TÊN_TOOL | việc cần lấy" thành các bước.
     *
     * <p>Rộng rãi có chủ đích: model hay quên dấu {@code |}, thêm số thứ tự, hoặc nêu tên tool
     * không có thật. Mọi lệch lạc đó đều giữ lại bước (model vẫn đọc được việc cần làm), chỉ là
     * bước không có tool hợp lệ thì không tham gia định tuyến — bịa ra một tool gần giống còn tệ
     * hơn nhiều so với việc không biết.
     */
    public static List<PlanStep> parse(String raw) {
        if (raw == null || raw.isBlank()) return List.of();

        List<PlanStep> steps = new ArrayList<>();
        for (String line : raw.split("\\R")) {
            String s = line.strip()
                    .replaceFirst("^[-*•]\\s*", "")      // bỏ dấu đầu dòng
                    .replaceFirst("^\\d+[.)]\\s*", "");  // bỏ số thứ tự dù đã dặn không đánh số
            if (s.isBlank() || s.length() > 200) continue;

            String tool = null;
            String what = s;
            int bar = s.indexOf('|');
            if (bar >= 0) {
                String head = s.substring(0, bar).strip().toLowerCase(Locale.ROOT);
                if (KNOWN_TOOLS.contains(head)) {
                    tool = head;
                    what = s.substring(bar + 1).strip();
                }
            }
            if (what.isBlank()) continue;
            steps.add(new PlanStep(tool, what));
            if (steps.size() >= MAX_STEPS) break;
        }
        return steps;
    }
}
