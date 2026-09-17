package com.kpitracking.ai.agent;

import com.kpitracking.service.ai.PlanStep;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Bóc "TÊN_TOOL | việc cần lấy" của {@link PlannerAgent} thành các bước.
 *
 * <p>Rộng rãi có chủ đích: model hay quên dấu {@code |}, thêm số thứ tự, hoặc nêu tên tool không
 * có thật. Mọi lệch lạc đó đều giữ lại bước (model chính vẫn đọc được việc cần làm), chỉ là bước
 * không có tool hợp lệ thì không tham gia định tuyến — bịa ra một tool gần giống còn tệ hơn nhiều
 * so với việc không biết.
 */
public final class PlanParser {

    private PlanParser() {}

    static final Set<String> KNOWN_TOOLS = Set.of(
            "search", "get_org_unit", "get_people", "get_kpi",
            "get_submissions", "rank", "compare_org_units", "get_analytics");

    /** Trần số bước; dài hơn thì gần như chắc chắn model đang lan man. */
    static final int MAX_STEPS = 4;

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
