package com.kpitracking.service.ai.review;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Chuẩn hoá tên CHỦ ĐỀ của bộ tiêu chí lấy từ tài liệu: "CHƯƠNG V. CƠ CHẾ THƯỞNG DỰ ÁN" → "Cơ chế thưởng dự án",
 * "Điều 4. Nhóm Truyền thông & Thương hiệu" → "Nhóm Truyền thông & Thương hiệu".
 *
 * <p>Tiêu đề viết HOA toàn bộ được hạ về chữ thường có hoa đầu câu, nhưng giữ đúng cách viết của các từ viết tắt
 * / tên riêng mà thân tài liệu viết khác chữ thường ("KeyGo", "KPI", "OKR").
 */
final class TopicNames {

    private static final Pattern NUMBERING = Pattern.compile(
            "^(CHƯƠNG|Chương|PHẦN|Phần|PHỤ LỤC|Phụ lục|Điều|ĐIỀU|Mục|MỤC)\\s+[0-9IVXLC]+[a-z]?\\s*[.:–-]?\\s*"
                    + "|^[IVXLC]{1,5}\\.\\s+|^\\d+(\\.\\d+)*[.)]?\\s+");
    private static final int MAX_LENGTH = 80;

    private final Map<String, String> casing = new HashMap<>();

    /**
     * @param body toàn văn tài liệu — để học cách viết các từ viết tắt / tên riêng. Từ viết HOA toàn bộ ("KPI")
     *             chỉ được học khi tài liệu không có chỗ nào viết nó ở dạng thường: "VÀ", "CÔNG" nằm trên dòng
     *             lẫn tiêu đề với thân bài của PDF vẫn là từ thường ("và", "công").
     */
    TopicNames(String body) {
        if (body == null) return;
        Set<String> plain = new HashSet<>();
        for (String line : body.split("\\r?\\n")) {
            if (isAllCaps(line)) continue;   // dòng tiêu đề viết hoa không dạy được cách viết
            for (String w : line.split("[^\\p{L}\\p{N}]+")) {
                if (w.length() < 2) continue;
                String key = w.toLowerCase(Locale.ROOT);
                if (!hasInnerUpper(w)) plain.add(key);
                // Cách viết pha trộn ("KeyGo") hơn viết HOA toàn bộ ("KEYGO") khi tài liệu có cả hai.
                else casing.merge(key, w, (old, now) -> isAllCaps(old) && !isAllCaps(now) ? now : old);
            }
        }
        casing.entrySet().removeIf(e -> isAllCaps(e.getValue()) && plain.contains(e.getKey()));
    }

    /** Tên chủ đề từ một dòng tiêu đề; {@code null} khi bỏ số thứ tự xong không còn gì (vd "PHỤ LỤC 02"). */
    String fromHeading(String heading) {
        if (heading == null) return null;
        String t = NUMBERING.matcher(heading.strip()).replaceFirst("").strip();
        if (t.isEmpty()) return null;
        if (isAllCaps(t)) t = sentenceCase(t);
        return shorten(t);
    }

    /** Nhãn mô hình đặt: bỏ ngoặc kép, viết hoa chữ đầu; "Quỹ Thưởng Dự Án" (hoa mọi chữ) → "Quỹ thưởng dự án". */
    String fromLabel(String label) {
        if (label == null || label.isBlank()) return null;
        String t = label.strip().replaceAll("^[\"'“”]+|[\"'“”.]+$", "").strip();
        if (t.isEmpty()) return null;
        if (isAllCaps(t) || isTitleCase(t)) return shorten(sentenceCase(t));
        return shorten(Character.toUpperCase(t.charAt(0)) + t.substring(1));
    }

    private static boolean isTitleCase(String s) {
        String[] words = s.split("\\s+");
        int letters = 0;
        for (String w : words) {
            if (w.isEmpty() || !Character.isLetter(w.charAt(0))) continue;
            if (!Character.isUpperCase(w.charAt(0))) return false;
            letters++;
        }
        return letters >= 2;
    }

    private String sentenceCase(String s) {
        StringBuilder out = new StringBuilder();
        for (String w : s.toLowerCase(Locale.ROOT).split(" ")) {
            if (!out.isEmpty()) out.append(' ');
            String bare = w.replaceAll("[^\\p{L}\\p{N}]", "");
            String known = casing.get(bare);
            out.append(known == null ? w : w.replace(bare, known));
        }
        String r = out.toString();
        return r.isEmpty() ? r : Character.toUpperCase(r.charAt(0)) + r.substring(1);
    }

    private static String shorten(String s) {
        return s.length() <= MAX_LENGTH ? s : s.substring(0, MAX_LENGTH).strip() + "…";
    }

    private static boolean isAllCaps(String s) {
        boolean letter = false;
        for (char c : s.toCharArray()) {
            if (Character.isLetter(c)) {
                letter = true;
                if (Character.isLowerCase(c)) return false;
            }
        }
        return letter;
    }

    /** Có chữ HOA sau chữ đầu ("KeyGo", "KPI") — từ thường viết hoa đầu câu ("Công") không tính. */
    private static boolean hasInnerUpper(String w) {
        for (int i = 1; i < w.length(); i++) {
            if (Character.isUpperCase(w.charAt(i))) return true;
        }
        return false;
    }
}
