package com.kpitracking.service.ai.review;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Mã căn cứ trong prompt và đường tra ngược ra đoạn văn gốc — MỘT chỗ duy nhất đánh số, để prompt
 * ({@link ReviewPrompts}) và bộ kiểm ({@link ReviewResultValidator}) luôn cùng một cách đếm.
 *
 * <p>Khách chốt (câu C4 của tài liệu phân tích): giữ đoạn văn gốc để trích dẫn khi giải thích điểm. Mô hình chỉ
 * được CHỌN mã ({@code "TC2"}, {@code "QC1"}); đoạn gốc do mã nguồn tra từ bộ tiêu chí đã xác nhận hoặc kho quy
 * chế, nên căn cứ hiện ra luôn là chữ có thật — mã lạ bị bỏ.
 */
public final class ReviewBasis {

    public static final String CRITERIA = "CRITERIA";
    public static final String REGULATION = "REGULATION";

    /** Loại dòng bộ tiêu chí đưa vào prompt chấm, theo thứ tự hiển thị — đánh mã theo đúng thứ tự này. */
    static final List<String[]> KIND_HEADINGS = List.of(
            new String[]{"TIEU_CHI", "Căn cứ chấm"},
            new String[]{"THANG_MUC", "Thang xếp loại"},
            new String[]{"THAM_KHAO", "Quy định khác của tổ chức (tham khảo)"});

    static final int MAX_BASIS = 4;
    static final int MAX_EXCERPT_CHARS = 800;

    private ReviewBasis() {}

    /** Dòng bộ tiêu chí có trong prompt, theo mã {@code TC1…}: nhóm theo {@link #KIND_HEADINGS}, đếm liền mạch. */
    public static Map<String, ReviewContext.CriteriaRow> criteriaRefs(ReviewContext.CriteriaSet set) {
        Map<String, ReviewContext.CriteriaRow> out = new LinkedHashMap<>();
        if (set == null || set.rows() == null) return out;
        int n = 1;
        for (String[] kh : KIND_HEADINGS) {
            for (ReviewContext.CriteriaRow r : set.rows()) {
                if (kh[0].equals(kindOf(r))) out.put("TC" + n++, r);
            }
        }
        return out;
    }

    /** Trích đoạn quy chế theo mã {@code QC1…}, đúng thứ tự trong ngữ cảnh. */
    public static Map<String, ReviewContext.Excerpt> excerptRefs(List<ReviewContext.Excerpt> excerpts) {
        Map<String, ReviewContext.Excerpt> out = new LinkedHashMap<>();
        if (excerpts == null) return out;
        for (int i = 0; i < excerpts.size(); i++) out.put("QC" + (i + 1), excerpts.get(i));
        return out;
    }

    /**
     * Mã mô hình chọn → căn cứ kèm đoạn gốc. Bỏ mã không có trong ngữ cảnh, trùng, hoặc trống; tối đa
     * {@value #MAX_BASIS} căn cứ.
     */
    public static List<ReviewResults.Basis> resolve(ReviewContext ctx, List<String> refs) {
        if (refs == null || refs.isEmpty()) return List.of();
        Map<String, ReviewContext.CriteriaRow> rows = criteriaRefs(ctx.criteriaSet());
        Map<String, ReviewContext.Excerpt> excerpts = excerptRefs(ctx.excerpts());
        String setTitle = ctx.criteriaSet() == null ? null : ctx.criteriaSet().title();

        Set<String> seen = new LinkedHashSet<>();
        List<ReviewResults.Basis> out = new ArrayList<>();
        for (String raw : refs) {
            if (out.size() >= MAX_BASIS) break;
            String ref = normalizeRef(raw);
            if (ref == null || !seen.add(ref)) continue;
            ReviewContext.CriteriaRow row = rows.get(ref);
            if (row != null) {
                boolean hasSource = row.sourceExcerpt() != null && !row.sourceExcerpt().isBlank();
                out.add(new ReviewResults.Basis(ref, CRITERIA, row.name(), join(setTitle, row.topic()),
                        cap(hasSource ? row.sourceExcerpt() : row.description()),
                        hasSource && row.excerptVerified()));
                continue;
            }
            ReviewContext.Excerpt e = excerpts.get(ref);
            if (e != null) {
                // Đoạn kho là chữ nguyên văn của tài liệu đã nạp — không qua mô hình. Bỏ dòng đường dẫn "[… › mục]"
                // bước nạp kho gắn vào đầu đoạn để tìm kiếm (tên tài liệu / mục đã hiện riêng).
                String text = e.text() == null ? null : BREADCRUMB.matcher(e.text()).replaceFirst("");
                out.add(new ReviewResults.Basis(ref, REGULATION, e.section(), e.document(), cap(text), true));
            }
        }
        return out;
    }

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Danh sách căn cứ -> cột JSON ({@code basis_citations}); rỗng -> {@code null}. */
    public static String toJson(List<ReviewResults.Basis> basis) {
        if (basis == null || basis.isEmpty()) return null;
        try {
            return JSON.writeValueAsString(basis);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Dòng "[Tài liệu › Mục]" đầu đoạn kho (ngữ cảnh cho tìm kiếm, không phải nội dung tài liệu). */
    private static final Pattern BREADCRUMB = Pattern.compile("^\\s*\\[[^\\]\\n]{0,200}]\\s*\\n?");

    private static final String REF = "\\[?\\b(?:TC|QC)\\d{1,3}\\b\\]?";
    /** Một mã hoặc một dãy mã: "TC2", "[QC1]", "TC2 và TC4", "TC1, TC3". */
    private static final Pattern REF_RUN = Pattern.compile(
            REF + "(?:\\s*(?:,|và|&|/)\\s*" + REF + ")*", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern ONE_REF = Pattern.compile("(?:TC|QC)\\d{1,3}", Pattern.CASE_INSENSITIVE);
    /** Cụm nối đứng ngay trước mã ("để đáp ứng", "theo tiêu chí") — bỏ cùng mã khi mã không tra được. */
    private static final Pattern CONNECTOR_TAIL = Pattern.compile(
            "\\s*(?:(?:để|nhằm)\\s+)?(?:(?:đáp ứng|theo|tuân thủ|phù hợp(?:\\s+với)?|thuộc|xem)\\s+)?"
                    + "(?:(?:yêu cầu|tiêu chí|quy định|mục|điều)\\s+)?$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final int MAX_NAME_CHARS = 60;

    /**
     * Mã căn cứ mô hình lỡ viết vào câu ("… cần bổ sung để đáp ứng TC3") → tên dòng tiêu chí / mục quy chế («…»):
     * người đọc không biết TC3 là gì, còn xoá trơn thì để lại chữ treo ("… cần bổ sung để."). Mã không tra được thì
     * bỏ cùng cụm nối đứng trước nó. Làm bằng mã thay vì thêm luật vào prompt.
     */
    public static String humanizeRefs(String text, ReviewContext ctx) {
        if (text == null) return null;
        Map<String, ReviewContext.CriteriaRow> rows = criteriaRefs(ctx == null ? null : ctx.criteriaSet());
        Map<String, ReviewContext.Excerpt> excerpts = excerptRefs(ctx == null ? null : ctx.excerpts());

        StringBuilder out = new StringBuilder();
        var m = REF_RUN.matcher(text);
        int last = 0;
        while (m.find()) {
            List<String> names = new ArrayList<>();
            var one = ONE_REF.matcher(m.group());
            while (one.find()) {
                String ref = one.group().toUpperCase(Locale.ROOT);
                String name = rows.containsKey(ref) ? rows.get(ref).name()
                        : excerpts.containsKey(ref) ? excerptName(excerpts.get(ref)) : null;
                if (name != null && !name.isBlank() && !names.contains(name)) names.add(shorten(name));
            }
            String before = text.substring(last, m.start());
            if (names.isEmpty()) {
                out.append(CONNECTOR_TAIL.matcher(before).replaceFirst(""));
            } else {
                out.append(before).append(joinNames(names));
            }
            last = m.end();
        }
        out.append(text.substring(last));

        String t = out.toString()
                .replaceAll("\\(\\s*\\)", "")
                .replaceAll("\\(\\s+", "(")
                .replaceAll("\\s+([.,;:!?)])", "$1")
                .replaceAll(",\\s*([.;:!?])", "$1")
                .replaceAll("[ \\t]{2,}", " ")
                .replaceAll("^[\\s,;:]+", "")
                .strip();
        if (t.isEmpty()) return null;
        // Bỏ cụm mở câu ("Theo TC1, …") thì câu còn lại vẫn viết hoa chữ đầu như câu gốc.
        if (Character.isUpperCase(text.strip().charAt(0)) && Character.isLowerCase(t.charAt(0))) {
            t = Character.toUpperCase(t.charAt(0)) + t.substring(1);
        }
        return t;
    }

    public static List<String> humanizeRefs(List<String> items, ReviewContext ctx) {
        if (items == null) return List.of();
        return items.stream().map(s -> humanizeRefs(s, ctx)).filter(s -> s != null && !s.isBlank()).toList();
    }

    private static String excerptName(ReviewContext.Excerpt e) {
        return e.section() != null && !e.section().isBlank() ? e.section() : e.document();
    }

    private static String shorten(String name) {
        String n = name.strip();
        return n.length() <= MAX_NAME_CHARS ? n : n.substring(0, MAX_NAME_CHARS).stripTrailing() + "…";
    }

    private static String joinNames(List<String> names) {
        List<String> quoted = names.stream().map(n -> "«" + n + "»").toList();
        if (quoted.size() == 1) return quoted.get(0);
        return String.join(", ", quoted.subList(0, quoted.size() - 1)) + " và " + quoted.get(quoted.size() - 1);
    }

    /** "[TC2]", "tc2", " TC2 " → "TC2"; không đúng dạng → {@code null}. */
    static String normalizeRef(String raw) {
        if (raw == null) return null;
        String r = raw.strip().replaceAll("[\\[\\]()]", "").toUpperCase(Locale.ROOT);
        return r.matches("(TC|QC)\\d{1,3}") ? r : null;
    }

    static String kindOf(ReviewContext.CriteriaRow r) {
        return r.kind() == null ? "TIEU_CHI" : r.kind();
    }

    private static String join(String a, String b) {
        boolean hasA = a != null && !a.isBlank(), hasB = b != null && !b.isBlank();
        if (hasA && hasB) return a.strip() + " › " + b.strip();
        return hasA ? a.strip() : hasB ? b.strip() : null;
    }

    private static String cap(String text) {
        if (text == null) return null;
        String t = text.strip();
        return t.length() <= MAX_EXCERPT_CHARS ? t : t.substring(0, MAX_EXCERPT_CHARS) + "…";
    }
}
