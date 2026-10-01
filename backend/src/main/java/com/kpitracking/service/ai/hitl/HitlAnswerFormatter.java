package com.kpitracking.service.ai.hitl;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Đổi câu trả lời có cấu trúc của thẻ hỏi (lựa chọn đã bấm + chữ tự nhập, theo từng câu) thành văn
 * bản cho model đọc ở vòng sau.
 *
 * <p>Làm ở máy chủ chứ không để client ghép chuỗi: ở đây mới biết lựa chọn nào CÓ THẬT trong thẻ,
 * nên một giá trị lạ (client cũ, client bị sửa) bị bỏ thay vì lọt vào prompt như thể người dùng chọn.
 */
public final class HitlAnswerFormatter {

    private HitlAnswerFormatter() {}

    /** Câu trả lời cho một câu hỏi: các giá trị đã chọn và chữ tự nhập (đều có thể trống). */
    public record ItemAnswer(List<String> values, String text) {}

    /**
     * @return văn bản cho model, hoặc {@code null} khi mọi câu đều trống (= người dùng bỏ qua)
     */
    public static String format(PendingQuestion question, List<ItemAnswer> answers) {
        if (question == null || answers == null) return null;
        List<PendingQuestion.Item> items = question.items();
        List<String> perItem = new ArrayList<>();
        boolean anything = false;
        for (int i = 0; i < items.size(); i++) {
            ItemAnswer a = i < answers.size() ? answers.get(i) : null;
            String one = formatOne(items.get(i), a);
            if (one != null) anything = true;
            perItem.add(one);
        }
        if (!anything) return null;
        if (items.size() == 1) return perItem.get(0);

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            if (sb.length() > 0) sb.append('\n');
            sb.append(items.get(i).question()).append(" → ")
              .append(perItem.get(i) == null ? "(bỏ qua)" : perItem.get(i));
        }
        return sb.toString();
    }

    private static String formatOne(PendingQuestion.Item item, ItemAnswer a) {
        if (a == null) return null;
        Set<String> allowed = new LinkedHashSet<>();
        for (PendingQuestion.Option o : item.options()) allowed.add(o.value());

        List<String> picked = new ArrayList<>();
        if (a.values() != null) {
            for (String v : a.values()) {
                if (v == null || !allowed.contains(v) || picked.contains(v)) continue;
                picked.add(v);
                if (!item.multiSelect()) break;   // chọn một thì chỉ lấy giá trị đầu
            }
        }
        String text = a.text() == null ? "" : a.text().strip();

        if (picked.isEmpty() && text.isEmpty()) return null;
        if (picked.isEmpty()) return text;
        String joined = String.join(", ", picked);
        return text.isEmpty() ? joined : joined + "; ghi thêm: " + text;
    }
}
