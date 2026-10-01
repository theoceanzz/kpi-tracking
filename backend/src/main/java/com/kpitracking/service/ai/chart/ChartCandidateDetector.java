package com.kpitracking.service.ai.chart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.service.ai.agent.AgentState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.List;

/**
 * Lượt này có gì để VẼ không — cổng chặn trước khi gọi {@code ChartAgent}.
 *
 * <p>Vì sao cần: mỗi lượt gọi thêm một lời gọi LLM là thêm độ trễ và tiền. "Phòng IT có bao nhiêu
 * người" trả về đúng một con số, vẽ biểu đồ là vô nghĩa. Chỉ gọi khi payload của tool có một MẢNG
 * ít nhất {@value #MIN_ROWS} phần tử mà mỗi phần tử là đối tượng có cả trường CHỮ (nhãn hạng mục)
 * lẫn trường SỐ (giá trị) — đúng hình dạng mà mọi biểu đồ cột/đường/lollipop cần.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChartCandidateDetector {

    /** Hai điểm mới thành một so sánh; một điểm thì câu chữ nói nhanh hơn biểu đồ. */
    static final int MIN_ROWS = 2;

    private final ObjectMapper objectMapper;

    /** Có ít nhất một payload đáng vẽ không. */
    public boolean hasCandidate(AgentState state) {
        return state != null && hasCandidate(state.getPayloads());
    }

    public boolean hasCandidate(List<AgentState.ToolPayload> payloads) {
        if (payloads == null) return false;
        for (AgentState.ToolPayload p : payloads) {
            if (hasPlottableArray(p.json())) return true;
        }
        return false;
    }

    /** Người dùng xin THẲNG một biểu đồ ("vẽ biểu đồ", "biểu đồ tròn", "dạng cột"…). */
    private static final java.util.regex.Pattern CHART_REQUEST = java.util.regex.Pattern.compile(
            "(biểu đồ|đồ thị|chart|(?<!\\p{L})vẽ(?!\\p{L})|dạng (tròn|cột|đường|bánh)|hình (tròn|cột|bánh))",
            java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE);

    public static boolean isChartRequest(String question) {
        return question != null && CHART_REQUEST.matcher(question).find();
    }

    private boolean hasPlottableArray(String json) {
        try {
            return scan(objectMapper.readTree(json), 0);
        } catch (Exception e) {
            // Payload không phải JSON hợp lệ thì coi như không vẽ được — không làm hỏng lượt vì việc đó.
            log.debug("Không đọc được payload để xét biểu đồ: {}", e.getMessage());
            return false;
        }
    }

    /** Đi sâu tối đa 4 tầng: payload của KeyGo gói kết quả trong content/rows/items/buckets… */
    private boolean scan(JsonNode node, int depth) {
        if (node == null || depth > 4) return false;
        if (node.isArray() && node.size() >= MIN_ROWS && plottableRows(node)) return true;
        Iterator<JsonNode> children = node.elements();
        while (children.hasNext()) {
            if (scan(children.next(), depth + 1)) return true;
        }
        return false;
    }

    private boolean plottableRows(JsonNode array) {
        int usable = 0;
        for (JsonNode row : array) {
            if (!row.isObject()) return false;
            boolean hasLabel = false;
            boolean hasNumber = false;
            Iterator<String> names = row.fieldNames();
            while (names.hasNext()) {
                JsonNode v = row.get(names.next());
                if (v.isTextual() && !v.asText().isBlank()) hasLabel = true;
                else if (v.isNumber()) hasNumber = true;
            }
            if (hasLabel && hasNumber) usable++;
        }
        return usable >= MIN_ROWS;
    }

    /** Payload của lượt, gói lại cho prompt của {@code ChartAgent}. */
    public String payloadsAsPrompt(AgentState state, int maxChars) {
        return payloadsAsPrompt(state.getPayloads(), maxChars);
    }

    public String payloadsAsPrompt(List<AgentState.ToolPayload> payloads, int maxChars) {
        StringBuilder sb = new StringBuilder();
        for (AgentState.ToolPayload p : payloads) {
            String block = "### " + p.tool() + "\n" + p.json() + "\n";
            if (sb.length() + block.length() > maxChars) break;
            sb.append(block);
        }
        return sb.toString();
    }
}
