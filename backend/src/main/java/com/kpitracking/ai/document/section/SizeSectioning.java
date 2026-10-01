package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.ParsedDocument;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Cắt theo ĐỘ DÀI (phương án cuối khi tài liệu không có cấu trúc nào): chia theo dòng, mỗi phần ≤
 * {@link #MAX_CHARS} ký tự — đủ ngắn để mô hình chép nguyên văn, đủ dài để giữ ngữ cảnh. Phần sau ghi "(tiếp n)".
 */
public final class SizeSectioning implements SectioningStrategy {

    public static final SizeSectioning INSTANCE = new SizeSectioning();

    public static final int MAX_CHARS = 5000;
    /** Dòng đánh số trang do PDF chèn ("Trang 12") — nhiễu, bỏ. */
    static final Pattern PAGE = Pattern.compile("^Trang\\s+\\d+$");

    private SizeSectioning() {}

    @Override
    public String name() {
        return "size";
    }

    @Override
    public List<DocumentSection> sections(ParsedDocument doc) {
        return split(doc.plainText(), List.of("Tài liệu"));
    }

    public static List<DocumentSection> split(String text, List<String> path) {
        List<DocumentSection> out = new ArrayList<>();
        if (text == null || text.isBlank()) return out;
        StringBuilder cur = new StringBuilder();
        int part = 1;
        for (String line : text.split("\\r?\\n")) {
            if (PAGE.matcher(line.strip()).matches()) continue;
            if (cur.length() + line.length() + 1 > MAX_CHARS && !cur.isEmpty()) {
                out.add(new DocumentSection(pathOf(path, part), cur.toString().strip()));
                cur.setLength(0);
                part++;
            }
            cur.append(line).append('\n');
        }
        if (!cur.toString().isBlank()) out.add(new DocumentSection(pathOf(path, part), cur.toString().strip()));
        return out;
    }

    private static List<String> pathOf(List<String> path, int part) {
        if (part == 1 || path.isEmpty()) return path;
        List<String> p = new ArrayList<>(path);
        p.set(p.size() - 1, p.get(p.size() - 1) + " (tiếp " + part + ")");
        return List.copyOf(p);
    }
}
