package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.ParsedDocument;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Cắt theo cấu trúc văn bản hành chính Việt Nam: Chương / Phần, Điều, Phụ lục (trong phụ lục là các mục La Mã
 * "I.", "II."…). Dùng cho quy chế, quy định — kể cả PDF không có kiểu tiêu đề, vì nhận ra mục bằng CHỮ.
 * (Chuyển từ {@code CriteriaSourceSplitter} — cùng kết quả.)
 *
 * <p>Mục quá ngắn gộp vào mục sau (tên ghi đủ các mục đã gộp); mục quá dài chia theo dòng. Không thấy tiêu đề
 * nào thì chia theo độ dài. Dòng số trang "Trang 12" của PDF bị bỏ.
 */
public final class LegalStructureSectioning implements SectioningStrategy {

    public static final LegalStructureSectioning INSTANCE = new LegalStructureSectioning();

    static final int MIN_CHARS = 250;
    static final int MAX_CHARS = SizeSectioning.MAX_CHARS;

    static final Pattern CHAPTER = Pattern.compile("^(CHƯƠNG|Chương|PHẦN|Phần)\\s+[IVXLC\\d]+\\b.*");
    /** Phải có số ("PHỤ LỤC 02", "Phụ lục I") — câu thường "Phụ lục này dùng để…" không phải tiêu đề. */
    static final Pattern APPENDIX = Pattern.compile("^(PHỤ LỤC|Phụ lục)\\s+([0-9]+|[IVX]+)\\b.*");
    static final Pattern ARTICLE = Pattern.compile("^Điều\\s+\\d+[a-z]?\\s*[.:].*");
    private static final Pattern ROMAN = Pattern.compile("^[IVX]{1,5}\\.\\s+\\S.*");

    private LegalStructureSectioning() {}

    @Override
    public String name() {
        return "legal";
    }

    /** Số dòng "Điều N." / "CHƯƠNG …" trong tài liệu — để loại tài liệu nhận ra văn bản pháp quy. */
    public static int markerCount(String text) {
        if (text == null) return 0;
        int n = 0;
        for (String line : text.split("\\r?\\n")) {
            String l = line.strip();
            if (ARTICLE.matcher(l).matches() || CHAPTER.matcher(l).matches()) n++;
        }
        return n;
    }

    /** Dòng tiêu đề chương / phần / phụ lục (có số) — cấp nhóm nội dung lớn nhất của văn bản. */
    public static boolean isPartHeading(String line) {
        if (line == null) return false;
        String l = line.strip();
        return CHAPTER.matcher(l).matches() || APPENDIX.matcher(l).matches();
    }

    /**
     * Chữ tài liệu bỏ dòng số trang — ĐÚNG bản mô hình được đọc. Kiểm đoạn gốc phải so trên bản này: đoạn
     * trích vắt qua ranh giới trang không có chữ "Trang 7" chen giữa như trong chữ gốc của PDF.
     */
    public static String withoutPageMarkers(String text) {
        if (text == null) return "";
        StringBuilder sb = new StringBuilder(text.length());
        for (String line : text.split("\\r?\\n")) {
            if (!SizeSectioning.PAGE.matcher(line.strip()).matches()) sb.append(line).append('\n');
        }
        return sb.toString();
    }

    @Override
    public List<DocumentSection> sections(ParsedDocument doc) {
        return split(doc.plainText());
    }

    /** Một mục thô: {@code chapter} là chương / phụ lục chứa nó (có thể rỗng), {@code title} là dòng tiêu đề. */
    private record Raw(String chapter, String title, String text) {}

    public static List<DocumentSection> split(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<Raw> raw = new ArrayList<>();
        String chapter = "";
        String title = "Phần đầu";
        StringBuilder body = new StringBuilder();
        boolean inAppendix = false;
        List<String> lines = text.lines().map(String::strip)
                .filter(l -> !SizeSectioning.PAGE.matcher(l).matches()).toList();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            boolean isChapter = CHAPTER.matcher(line).matches();
            boolean isAppendix = APPENDIX.matcher(line).matches();
            boolean isArticle = ARTICLE.matcher(line).matches();
            boolean isRoman = inAppendix && ROMAN.matcher(line).matches();
            if (isChapter || isAppendix || isArticle || isRoman) {
                flush(raw, chapter, title, body);
                String heading = line;
                if (isChapter || isAppendix) {
                    heading = withContinuation(line, i + 1 < lines.size() ? lines.get(i + 1) : null);
                    chapter = heading;
                    inAppendix = isAppendix;
                }
                title = heading;
            }
            body.append(line).append('\n');
        }
        flush(raw, chapter, title, body);
        if (raw.size() <= 1) return SizeSectioning.split(raw.isEmpty() ? text : raw.get(0).text(), List.of("Tài liệu"));
        List<DocumentSection> out = new ArrayList<>();
        for (Raw r : mergeShort(raw)) {
            List<String> path = r.chapter().isBlank() || r.chapter().equals(r.title())
                    ? List.of(r.title()) : List.of(r.chapter(), r.title());
            if (r.text().length() <= MAX_CHARS) out.add(new DocumentSection(path, r.text()));
            else out.addAll(SizeSectioning.split(r.text(), path));
        }
        return out;
    }

    /**
     * Tiêu đề chương / phụ lục trong PDF hay xuống dòng: "CHƯƠNG IV. … CÔNG VIỆC TRÊN" + "KEYGO", "PHỤ LỤC 02"
     * + "PHIẾU XÁC ĐỊNH VÀ PHÂN BỔ THƯỞNG DỰ ÁN". Dòng sau viết HOA toàn bộ, ngắn, không phải tiêu đề khác → nối
     * vào tên (chỉ nối một dòng). Chỉ còn số ("PHỤ LỤC 02") thì nối bằng ". ", còn lại nối tiếp bằng dấu cách.
     */
    static String withContinuation(String heading, String next) {
        if (next == null || next.isEmpty() || next.length() > MAX_TITLE_LINE || !allCaps(next)) return heading;
        if (CHAPTER.matcher(next).matches() || APPENDIX.matcher(next).matches() || ROMAN.matcher(next).matches()
                || ARTICLE_UPPER.matcher(next).matches()) return heading;
        return BARE_NUMBER.matcher(heading).matches()
                ? heading.replaceFirst("\\s*[.:]?$", "") + ". " + next
                : heading + " " + next;
    }

    private static final int MAX_TITLE_LINE = 90;
    private static final Pattern BARE_NUMBER = Pattern.compile(
            "^(CHƯƠNG|Chương|PHẦN|Phần|PHỤ LỤC|Phụ lục)\\s+([0-9]+|[IVXLC]+)\\s*[.:]?$");
    private static final Pattern ARTICLE_UPPER = Pattern.compile("^(ĐIỀU|Điều)\\s+\\d+.*");

    private static boolean allCaps(String s) {
        boolean letter = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLetter(c)) {
                if (Character.isLowerCase(c)) return false;
                letter = true;
            }
        }
        return letter;
    }

    private static void flush(List<Raw> out, String chapter, String title, StringBuilder body) {
        String t = body.toString().strip();
        if (!t.isEmpty()) out.add(new Raw(chapter, title, t));
        body.setLength(0);
    }

    /**
     * Mục quá ngắn (tiêu đề chương, lời dẫn, điều khoản một câu) gộp vào mục sau để mô hình có đủ ngữ cảnh.
     * Tên mục gộp ghi ĐỦ các mục đã gộp — chỉ giữ tên mục sau thì nội dung "Điều 1" lại mang nhãn "Điều 2".
     */
    private static List<Raw> mergeShort(List<Raw> in) {
        List<Raw> out = new ArrayList<>();
        StringBuilder carry = new StringBuilder();
        List<String> carriedTitles = new ArrayList<>();
        Raw carried = null;
        for (int i = 0; i < in.size(); i++) {
            Raw s = in.get(i);
            // Không gộp qua ranh giới chương: điều khoản ngắn trước "CHƯƠNG I" gộp vào chương I sẽ mang nhầm chương.
            if (carried != null && !s.chapter().equals(carried.chapter())) {
                out.add(new Raw(carried.chapter(), mergedTitle(carriedTitles, carried.title()), carry.toString()));
                carry.setLength(0);
                carriedTitles.clear();
                carried = null;
            }
            String text = carry.isEmpty() ? s.text() : carry + "\n" + s.text();
            boolean last = i == in.size() - 1;
            // Tiêu đề chương đứng một mình đã có trong nhãn (chapter) — không lặp lại trong tên.
            if (!s.title().equals(s.chapter())) carriedTitles.add(s.title());
            if (text.length() < MIN_CHARS && !last) {
                carry.setLength(0);
                carry.append(text);
                carried = s;
                continue;
            }
            carry.setLength(0);
            carried = null;
            out.add(new Raw(s.chapter(), mergedTitle(carriedTitles, s.title()), text));
            carriedTitles.clear();
        }
        return out;
    }

    private static String mergedTitle(List<String> titles, String fallback) {
        List<String> real = titles.size() > 1 ? titles.stream().filter(t -> !t.equals("Phần đầu")).toList() : titles;
        if (real.isEmpty()) return fallback;
        if (real.size() == 1) return real.get(0);
        return String.join(" · ", real.stream().map(t -> t.length() <= 60 ? t : t.substring(0, 60) + "…").toList());
    }
}
