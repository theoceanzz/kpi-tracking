package com.kpitracking.service.ai.chart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.ChartSpec;
import com.kpitracking.service.ai.agent.AgentState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Lưới an toàn của phần biểu đồ: bỏ biểu đồ sai hình dạng, và — quan trọng nhất — bỏ biểu đồ có CON
 * SỐ KHÔNG CÓ trong kết quả tool của lượt.
 *
 * <p>Cùng tinh thần với {@code AnswerValidator} ở phần chữ: model kể lại số thì còn đọc ra được, chứ
 * vẽ một cột cao 92 % mà không ai lần được số đó ở đâu thì người xem tin ngay. Thà mất biểu đồ —
 * câu trả lời kèm bảng vẫn còn nguyên.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChartSpecValidator {

    private static final Set<String> TYPES = Set.of(
            "bar", "groupedBar", "stackedBar", "stacked100", "lollipop",
            "line", "area", "bullet", "donut", "histogram", "metricCards");
    private static final Set<String> NAMED_COLORS = Set.of(
            "success", "warning", "error", "info", "primary", "ai", "neutral");
    private static final Set<String> PALETTES = Set.of("series", "rating", "achievement", "status", "metric");
    private static final Set<String> FORMATS = Set.of("number", "percent", "score5", "currency");

    static final int MAX_CHARTS = 2;
    static final int MAX_ROWS = 12;
    static final int MAX_SERIES = 4;
    /** Sai số cho phép khi so số của biểu đồ với số trong payload: model hay làm tròn 82,4 -> 82. */
    private static final double TOLERANCE = 0.1;

    private final ObjectMapper objectMapper;

    /** Giữ lại các biểu đồ hợp lệ, theo đúng thứ tự model đề nghị. */
    public List<ChartSpec> validate(List<ChartSpec> charts, AgentState state) {
        return validate(charts, state == null ? List.of() : state.getPayloads());
    }

    /** Như trên, trên một nguồn payload chỉ định (vd payload lượt trước ở câu "vẽ biểu đồ tròn đi"). */
    public List<ChartSpec> validate(List<ChartSpec> charts, List<AgentState.ToolPayload> payloads) {
        if (charts == null || charts.isEmpty()) return List.of();
        Set<Double> allowed = numbersIn(payloads);
        List<ChartSpec> out = new ArrayList<>();
        for (ChartSpec chart : charts) {
            if (out.size() >= MAX_CHARTS) break;
            String problem = problemOf(chart, allowed);
            if (problem != null) {
                log.info("Bỏ biểu đồ '{}' ({}): {}", chart.getTitle(), chart.getType(), problem);
                continue;
            }
            chart.setId("chart-" + (out.size() + 1));
            out.add(chart);
        }
        return out;
    }

    /** {@code null} = hợp lệ; ngược lại là lý do bỏ (viết cho log, không cho người dùng). */
    private String problemOf(ChartSpec c, Set<Double> allowed) {
        if (c == null) return "null";
        if (c.getType() == null || !TYPES.contains(c.getType())) return "loại lạ: " + (c == null ? null : c.getType());
        if (c.getTitle() == null || c.getTitle().isBlank()) return "thiếu tiêu đề";
        if (c.getData() == null || c.getData().isEmpty()) return "không có dữ liệu";
        if (c.getData().size() > MAX_ROWS) return "quá " + MAX_ROWS + " hạng mục";
        if (c.getSeries() == null || c.getSeries().isEmpty()) return "không có chuỗi số liệu";
        if (c.getSeries().size() > MAX_SERIES) return "quá " + MAX_SERIES + " chuỗi";
        if (c.getCategoryKey() == null || c.getCategoryKey().isBlank()) return "thiếu categoryKey";
        if (c.getPalette() != null && !PALETTES.contains(c.getPalette())) return "bảng màu lạ: " + c.getPalette();
        if (c.getValueFormat() != null && !FORMATS.contains(c.getValueFormat())) return "định dạng lạ: " + c.getValueFormat();

        for (ChartSpec.Series s : c.getSeries()) {
            if (s == null || s.getKey() == null || s.getKey().isBlank()) return "chuỗi thiếu key";
            if (s.getColor() != null && !validColor(s.getColor())) return "màu lạ: " + s.getColor();
        }

        for (Map<String, Object> row : c.getData()) {
            if (row == null) return "dòng null";
            Object category = row.get(c.getCategoryKey());
            if (category == null || String.valueOf(category).isBlank()) {
                return "dòng thiếu '" + c.getCategoryKey() + "'";
            }
            boolean anyValue = false;
            for (ChartSpec.Series s : c.getSeries()) {
                Object v = row.get(s.getKey());
                if (v == null) continue;
                if (!(v instanceof Number n)) return "ô '" + s.getKey() + "' không phải số: " + v;
                anyValue = true;
                if (!allowed.isEmpty() && !known(n.doubleValue(), allowed)) {
                    return "số " + n + " không có trong kết quả công cụ";
                }
            }
            if (!anyValue) return "dòng '" + category + "' không có giá trị nào";
        }
        return null;
    }

    private boolean validColor(String color) {
        if (NAMED_COLORS.contains(color)) return true;
        if (!color.startsWith("series:")) return false;
        try {
            int i = Integer.parseInt(color.substring("series:".length()));
            return i >= 0 && i <= 7;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** Số 0 và 100 luôn được (mốc, tỉ lệ đầy); còn lại phải khớp một số trong payload. */
    private boolean known(double value, Set<Double> allowed) {
        if (value == 0d || value == 100d) return true;
        for (double a : allowed) {
            if (Math.abs(a - value) <= TOLERANCE) return true;
            // Payload cho tỉ lệ 0..1 còn biểu đồ vẽ %: 0,824 -> 82,4.
            if (Math.abs(a * 100 - value) <= TOLERANCE) return true;
            if (Math.abs(a / 100 - value) <= TOLERANCE) return true;
        }
        return false;
    }

    /** Mọi số xuất hiện trong kết quả tool của lượt (kể cả trong chuỗi, vd "82,4 %"). */
    private Set<Double> numbersIn(List<AgentState.ToolPayload> payloads) {
        Set<Double> out = new HashSet<>();
        if (payloads == null) return out;
        for (AgentState.ToolPayload p : payloads) {
            try {
                collect(objectMapper.readTree(p.json()), out, 0);
            } catch (Exception e) {
                log.debug("Không đọc được payload khi gom số: {}", e.getMessage());
            }
        }
        return out;
    }

    private void collect(JsonNode node, Set<Double> out, int depth) {
        if (node == null || depth > 8 || out.size() > 5_000) return;
        if (node.isNumber()) {
            out.add(node.asDouble());
            return;
        }
        if (node.isTextual()) {
            collectFromText(node.asText(), out);
            return;
        }
        Iterator<JsonNode> it = node.elements();
        while (it.hasNext()) collect(it.next(), out, depth + 1);
    }

    /** Số nằm trong câu chữ của payload ("đạt 82,4 % mục tiêu") cũng là số CÓ THẬT. */
    private void collectFromText(String text, Set<Double> out) {
        if (text == null || text.length() > 2_000) return;
        var m = java.util.regex.Pattern.compile("-?\\d+(?:[.,]\\d+)?").matcher(text);
        while (m.find() && out.size() <= 5_000) {
            try {
                out.add(Double.parseDouble(m.group().replace(',', '.').toLowerCase(Locale.ROOT)));
            } catch (NumberFormatException ignored) {
                // không phải số đọc được thì bỏ qua
            }
        }
    }
}
