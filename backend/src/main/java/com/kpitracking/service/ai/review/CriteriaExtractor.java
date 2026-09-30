package com.kpitracking.service.ai.review;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.agent.CriteriaExtractionAgent;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.profile.CriteriaScheme;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import dev.langchain4j.service.Result;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.concurrent.DelegatingSecurityContextCallable;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Bóc bộ tiêu chí TỪNG MỤC một — các mục do {@code DocumentProfile} của loại tài liệu cắt sẵn — mỗi mục một lời
 * gọi {@link CriteriaExtractionAgent}, song song có trần. Kết quả giữ đúng thứ tự tài liệu; mục không có gì để
 * bóc và mục AI lỗi đều được liệt kê lại (luật "không im lặng").
 *
 * <p>Mỗi dòng ra có <b>vai trò</b> (trong phạm vi {@link CriteriaScheme} của loại tài liệu) và <b>chủ đề</b> lấy
 * từ chính tài liệu (tên chương / tên trang tính / tên mục / nhãn mô hình) — tài liệu có bao nhiêu mảng nội dung
 * thì ra bấy nhiêu nhóm.
 */
@Component
@Slf4j
public class CriteriaExtractor {

    static final int MAX_ROWS = 200;
    /** Phần nội dung ngắn hơn thế ("Tiến độ") trùng chữ ở đâu cũng được — không đủ làm trích dẫn. */
    static final int MIN_RECOVERED_EXCERPT = 12;
    static final int MIN_SPLIT_ROWS = 3;
    /** Chủ đề chung của các mục đứng trước chương đầu tiên (quyết định ban hành, mục đích, phạm vi…). */
    static final String PREAMBLE_TOPIC = "Phần mở đầu";
    /** Tên cũ còn trong bản nháp trước khi có chủ đề: nay là TRA_CUU + chủ đề tương ứng. */
    private static final Set<String> LEGACY_LOOKUP = Set.of("NHIEM_VU", "THUONG");

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Extracted(String chuDe, String nhom, List<Row> dong, List<Row> tieuChi) {}

    /** Kết quả một mục: chủ đề nghiệp vụ mô hình gán (DANH_GIA/THUONG/…), nhãn nhóm mô hình đặt, các dòng. */
    record Parsed(String topic, String label, List<Row> rows, String raw) {}

    /**
     * Vai trò cuối cùng của một dòng, theo chủ đề MỤC chứa nó và bộ nhóm của loại tài liệu — mô hình nhìn một mục
     * đơn lẻ hay coi "các yếu tố xét chia thưởng" là căn cứ chấm, nên mã chặn: mục thưởng / tổ chức → chỉ tra
     * cứu; căn cứ chấm / thang mức chỉ nhận từ mục đánh giá (ở mục khác hạ thành "AI đọc khi chấm"); vai trò
     * loại tài liệu không dùng → vai trò dự phòng của scheme. Không có chủ đề (định dạng cũ) → giữ vai trò mô hình.
     */
    static String roleFor(String topic, String rowRole, CriteriaScheme scheme) {
        String role = rowRole;
        if ("THUONG".equals(topic) || "TO_CHUC".equals(topic)) {
            role = CriteriaScheme.TRA_CUU.code();
        } else if (topic != null && !"DANH_GIA".equals(topic) && isScoring(role)) {
            role = CriteriaScheme.THAM_KHAO.code();
        }
        return scheme.allows(role) ? role : scheme.fallbackRole();
    }

    private static boolean isScoring(String role) {
        return CriteriaScheme.TIEU_CHI.code().equals(role) || CriteriaScheme.THANG_MUC.code().equals(role);
    }

    /** Một dòng bóc được; {@code section}, {@code topic} do mã gắn (mục gốc, chủ đề), không do mô hình. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Row(String loai, String ten, String moTa, Double trongSo, List<String> cacMuc, String phamVi,
                      String doanGoc, String section, String topic) {

        public Row(String loai, String ten, String moTa, Double trongSo, List<String> cacMuc, String phamVi,
                   String doanGoc, String section) {
            this(loai, ten, moTa, trongSo, cacMuc, phamVi, doanGoc, section, null);
        }

        Row withSection(String s) {
            return new Row(loai, ten, moTa, trongSo, cacMuc, phamVi, doanGoc, s, topic);
        }

        Row withKind(String k) {
            return new Row(k, ten, moTa, trongSo, cacMuc, phamVi, doanGoc, section, topic);
        }

        Row withTopic(String t) {
            return new Row(loai, ten, moTa, trongSo, cacMuc, phamVi, doanGoc, section, t);
        }

        Row withName(String n) {
            return new Row(loai, n, moTa, trongSo, cacMuc, phamVi, doanGoc, section, topic);
        }

        boolean hasContent() {
            return !blank(ten) || !blank(moTa) || (cacMuc != null && cacMuc.stream().anyMatch(x -> !blank(x)));
        }

        /**
         * Mô hình đôi khi để trống "ten" dù đã chép đủ nội dung (gặp ở mục "Nguyên tắc phân công": cả mục thành
         * "bỏ qua"). Thiếu tên thì lấy đầu nội dung làm tên — không bao giờ bỏ một dòng có nội dung.
         */
        Row withNameFallback() {
            if (!blank(ten)) return this;
            String base = !blank(moTa) ? moTa
                    : cacMuc == null ? "" : cacMuc.stream().filter(x -> !blank(x)).findFirst().orElse("");
            return withName(shorten(base.strip(), 90));
        }

        /**
         * Mô hình đôi khi bỏ trống "doanGoc" (gặp khi nó tách một danh sách thành nhiều dòng — mỗi ý một dòng).
         * Khi đó lấy chính phần nội dung đã chép (mô tả, rồi từng ý, rồi tên) nếu NGUYÊN VĂN có trong mục — vẫn
         * là trích dẫn thật; không có thì để trống cho người duyệt kiểm. Đoạn gốc mô hình đã ghi thì không đụng.
         */
        Row withExcerptFrom(String compactSection) {
            // Chữ tô đậm "**…**" mô hình chèn vào đoạn gốc không có trong tài liệu — bỏ trước khi hiện / kiểm.
            if (!blank(doanGoc)) return doanGoc.contains("**") ? withExcerpt(doanGoc.replace("**", "")) : this;
            List<String> candidates = new ArrayList<>();
            candidates.add(moTa);
            if (cacMuc != null) candidates.addAll(cacMuc);
            candidates.add(ten);
            for (String c : candidates) {
                if (!blank(c) && compact(c).length() >= MIN_RECOVERED_EXCERPT && excerptFound(compactSection, c)) {
                    return withExcerpt(c.strip());
                }
            }
            return this;
        }

        Row withExcerpt(String e) {
            return new Row(loai, ten, moTa, trongSo, cacMuc, phamVi, e, section, topic);
        }

        /** Chỉ có tên + ít nhất một ý, không mô tả riêng — dạng mô hình tạo khi tách một câu liệt kê thành nhiều dòng. */
        boolean isSplitItem() {
            return !CriteriaScheme.TIEU_CHI.code().equals(kind()) && !blank(doanGoc) && blank(moTa)
                    && (cacMuc == null || cacMuc.stream().filter(x -> !blank(x)).count() <= 1);
        }

        /** Vai trò mô hình ghi (chuẩn hoá); tên cũ NHIEM_VU/THUONG → TRA_CUU; trống → TIEU_CHI. */
        public String kind() {
            String k = loai == null ? "" : loai.strip().toUpperCase(Locale.ROOT);
            if (LEGACY_LOOKUP.contains(k)) return CriteriaScheme.TRA_CUU.code();
            return CriteriaScheme.known(k).isPresent() ? k : CriteriaScheme.TIEU_CHI.code();
        }
    }

    /**
     * Mô hình hay đặt MỘT tên chung cho cả danh sách (6 căn cứ chấm cùng tên "Tiêu chí đánh giá kết quả công
     * việc", tên thật nằm trong "cacMuc"). Trong một mục, dòng trùng tên mà chỉ có một ý → lấy ý đó làm tên.
     */
    static List<Row> distinctNames(List<Row> rows) {
        java.util.Map<String, Long> counts = rows.stream()
                .collect(java.util.stream.Collectors.groupingBy(r -> r.ten().strip().toLowerCase(Locale.ROOT),
                        java.util.stream.Collectors.counting()));
        return rows.stream().map(r -> {
            List<String> items = r.cacMuc() == null ? List.of() : r.cacMuc().stream().filter(x -> !blank(x)).toList();
            boolean duplicated = counts.getOrDefault(r.ten().strip().toLowerCase(Locale.ROOT), 0L) > 1;
            if (!duplicated || items.size() != 1) return r;
            String item = items.get(0).strip();
            return r.withName(shorten(Character.toUpperCase(item.charAt(0)) + item.substring(1), 90));
        }).toList();
    }

    /**
     * Mô hình hay tách MỘT câu liệt kê ("…căn cứ vào đóng góp thực tế, bao gồm A, B, C…") thành nhiều dòng mỗi
     * dòng một ý, cùng một đoạn gốc — trái luật "một danh sách = một dòng", màn duyệt dài ra vô ích. Từ
     * {@value #MIN_SPLIT_ROWS} dòng liền nhau như thế (cùng vai trò, cùng đoạn gốc) gộp lại thành MỘT dòng, mỗi
     * dòng cũ thành một ý. Căn cứ chấm không gộp — mỗi căn cứ phải là một dòng riêng.
     */
    static List<Row> mergeSplitLists(List<Row> rows) {
        List<Row> out = new ArrayList<>();
        int i = 0;
        while (i < rows.size()) {
            Row first = rows.get(i);
            int j = i + 1;
            if (first.isSplitItem()) {
                String key = compact(first.doanGoc());
                while (j < rows.size() && rows.get(j).isSplitItem() && rows.get(j).kind().equals(first.kind())
                        && compact(rows.get(j).doanGoc()).equals(key)) j++;
            }
            if (j - i >= MIN_SPLIT_ROWS) out.add(mergedList(rows.subList(i, j)));
            else out.addAll(rows.subList(i, j));
            i = j;
        }
        return out;
    }

    private static Row mergedList(List<Row> group) {
        Row first = group.get(0);
        List<String> items = group.stream().map(r -> r.cacMuc() == null ? r.ten()
                : r.cacMuc().stream().filter(x -> !blank(x)).findFirst().orElse(r.ten())).toList();
        // Tên = lời dẫn trước dấu ":" của đoạn gốc ("Nguyên tắc", "Các yếu tố xem xét bao gồm"); không có thì tên mục.
        String excerpt = first.doanGoc().strip();
        int colon = excerpt.indexOf(':');
        String lead = colon > 0 && colon <= 60 ? excerpt.substring(0, colon).strip() : null;
        String sectionName = first.section() == null ? null
                : first.section().substring(first.section().lastIndexOf('›') + 1).strip();
        String name = !blank(lead) ? lead : !blank(sectionName) ? sectionName : first.ten();
        return new Row(first.loai(), shorten(name, 90), null, null, items, first.phamVi(), excerpt,
                first.section(), first.topic());
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String shorten(String s, int max) {
        if (s.length() <= max) return s;
        int cut = s.lastIndexOf(' ', max);
        return s.substring(0, cut > max / 2 ? cut : max) + "…";
    }

    /**
     * @param skipped mục không có nội dung cần bóc — biểu mẫu trống, chữ ký, trang bìa (tên mục)
     * @param failed  mục AI lỗi / quá giờ (tên mục) — người duyệt nên xem tay hoặc bóc lại
     */
    public record Outcome(List<Row> rows, List<String> skipped, List<String> failed, int sections) {}

    private final CriteriaExtractionAgent agent;
    private final int timeoutSeconds;
    private final ExecutorService pool;

    public CriteriaExtractor(CriteriaExtractionAgent agent,
                             @Value("${app.ai.review.max-parallel:4}") int maxParallel,
                             @Value("${app.ai.review.timeout-seconds:90}") int timeoutSeconds) {
        this.agent = agent;
        this.timeoutSeconds = timeoutSeconds;
        this.pool = Executors.newFixedThreadPool(Math.max(1, maxParallel), r -> {
            Thread t = new Thread(r, "kg-ai-criteria");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    /**
     * @param sections các mục đã cắt theo loại tài liệu
     * @param scheme   bộ nhóm của loại tài liệu (vai trò được dùng + chủ đề lấy từ đâu)
     * @param body     toàn văn — để đặt tên chủ đề đúng cách viết của tài liệu ("KeyGo", "KPI")
     */
    public Outcome extract(String documentTitle, List<DocumentSection> sections, CriteriaScheme scheme, String body) {
        SecurityContext security = SecurityContextHolder.getContext();
        String roles = String.join(", ", scheme.roles().stream().map(CriteriaScheme.Role::code).toList());
        List<Future<Parsed>> futures = new ArrayList<>();
        for (DocumentSection s : sections) {
            String input = "TÀI LIỆU: " + documentTitle + "\nMỤC: " + s.label()
                    + "\nVAI TRÒ ĐƯỢC DÙNG: " + roles + "\n\n" + s.text();
            Callable<Parsed> job = () -> {
                AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_REVIEW);
                try {
                    return parse(agent.extract(input));
                } finally {
                    AiTokenUsageRecorder.clearFeature();
                }
            };
            futures.add(pool.submit(DelegatingSecurityContextCallable.create(job, security)));
        }

        TopicNames names = new TopicNames(body);
        int firstChapter = firstChapterIndex(sections);
        java.util.Map<String, String> topicSpelling = new java.util.HashMap<>();
        List<Row> rows = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (int i = 0; i < sections.size(); i++) {
            DocumentSection section = sections.get(i);
            String label = section.label();
            String sectionText = compact(LegalStructureSectioning.withoutPageMarkers(section.text()));
            try {
                Parsed got = futures.get(i).get(timeoutSeconds, TimeUnit.SECONDS);
                String topic = got.topic() == null ? null : got.topic().strip().toUpperCase(Locale.ROOT);
                String group = sameSpelling(topicSpelling,
                        topicOf(section, got.label(), scheme, names, i < firstChapter));
                List<Row> named = distinctNames(mergeSplitLists(got.rows().stream().filter(Row::hasContent)
                        .map(r -> r.withNameFallback().withExcerptFrom(sectionText).withSection(label).withTopic(group)
                                .withKind(roleFor(topic, r.kind(), scheme)))
                        .toList()));
                if (named.isEmpty()) {
                    // Để dò khi người duyệt thấy một mục có nội dung mà bị "bỏ qua".
                    log.info("Mục «{}» không ra dòng nào; mô hình trả: {}", label,
                            got.raw() == null ? "" : got.raw().substring(0, Math.min(400, got.raw().length())));
                    skipped.add(label);
                }
                else if (rows.size() + named.size() > MAX_ROWS) failed.add(label + " (vượt " + MAX_ROWS + " dòng — chưa bóc)");
                else rows.addAll(named);
            } catch (Exception e) {
                futures.get(i).cancel(true);
                log.warn("Bóc tiêu chí mục «{}» lỗi: {}", label, e.toString());
                failed.add(label);
            }
        }
        log.info("Bóc bộ tiêu chí «{}»: {} mục → {} dòng, {} chủ đề, {} mục không có nội dung, {} mục lỗi",
                documentTitle, sections.size(), rows.size(), topicSpelling.size(), skipped.size(), failed.size());
        return new Outcome(rows, skipped, failed, sections.size());
    }

    static String topicOf(DocumentSection section, String modelLabel, CriteriaScheme scheme, TopicNames names) {
        return topicOf(section, modelLabel, scheme, names, false);
    }

    /**
     * Chủ đề của một mục theo {@link CriteriaScheme.TopicSource}: tên chương / phụ lục (bỏ số thứ tự, hạ chữ HOA)
     * khi tài liệu có — phụ lục chỉ có số ("PHỤ LỤC 03") dùng nhãn mô hình; tài liệu có chương thì các mục đứng
     * trước chương đầu (quyết định ban hành, mục đích…) chung một chủ đề {@value #PREAMBLE_TOPIC}, không có chương
     * thì nhãn mô hình; tên trang tính; tên mục.
     */
    static String topicOf(DocumentSection section, String modelLabel, CriteriaScheme scheme, TopicNames names,
                          boolean beforeFirstChapter) {
        return switch (scheme.topicSource()) {
            case NONE -> null;
            case SHEET -> section.path().isEmpty() ? null : names.fromLabel(section.path().get(0));
            case SECTION_TITLE -> firstNonNull(names.fromHeading(section.title()), names.fromLabel(modelLabel));
            case CHAPTER_OR_MODEL -> {
                if (beforeFirstChapter) yield PREAMBLE_TOPIC;
                String chapter = chapterOf(section);
                String fromChapter = chapter == null ? null : names.fromHeading(chapter);
                yield firstNonNull(fromChapter, names.fromLabel(modelLabel), names.fromHeading(section.title()));
            }
        };
    }

    /** Chương / phụ lục chứa mục: phần đầu đường dẫn, hoặc chính mục khi nó là một phụ lục / chương không chia điều. */
    private static String chapterOf(DocumentSection section) {
        List<String> path = section.path();
        if (path.size() > 1) return path.get(0);
        return path.size() == 1 && LegalStructureSectioning.isPartHeading(path.get(0)) ? path.get(0) : null;
    }

    /**
     * Vị trí mục đầu tiên nằm trong "CHƯƠNG …" / "PHỤ LỤC …"; tài liệu không đánh chương kiểu đó (kể cả Word chia
     * theo tiêu đề thường) → 0: không có phần mở đầu.
     */
    private static int firstChapterIndex(List<DocumentSection> sections) {
        for (int i = 0; i < sections.size(); i++) {
            List<String> path = sections.get(i).path();
            if (!path.isEmpty() && LegalStructureSectioning.isPartHeading(path.get(0))) return i;
        }
        return 0;
    }

    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    /** Gộp chủ đề trùng không phân biệt hoa thường — giữ cách viết gặp đầu tiên. */
    private static String sameSpelling(java.util.Map<String, String> seen, String topic) {
        if (topic == null) return null;
        return seen.computeIfAbsent(topic.toLowerCase(Locale.ROOT), k -> topic);
    }

    static Parsed parse(Result<String> res) throws Exception {
        String raw = res == null ? null : res.content();
        if (raw == null) throw new IllegalStateException("mô hình không trả lời");
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalStateException("không có JSON");
        Extracted e = MAPPER.readValue(raw.substring(start, end + 1), Extracted.class);
        if (e == null) return new Parsed(null, null, List.of(), raw);
        List<Row> rows = e.dong() != null ? e.dong() : e.tieuChi();
        return new Parsed(e.chuDe(), e.nhom(), rows == null ? List.of() : rows, raw);
    }

    /**
     * Dạng so khớp: chuẩn hoá như trích dẫn bài nộp, rồi bỏ hết khoảng trắng, dấu đầu dòng và dấu câu — chữ bóc
     * từ PDF hay dính / tách khoảng trắng khác bản mô hình chép ("•Một" và "• Một"), và mô hình hay thêm nhãn
     * ("Chức năng: Chịu trách nhiệm…" với nguồn "1. Chức năng" xuống dòng), nối các ý bằng ".;", tô đậm "**…**".
     * Chữ vẫn phải đúng từng chữ, đúng thứ tự.
     */
    public static String compact(String s) {
        return ReviewResultValidator.normalize(s).replaceAll("[\\s\u2022\u25cf\u25aa\u25e6\\-\u2013\u2014\\uFFFF\\uF0B7.,;:!?()\\[\\]*]", "");
    }

    /**
     * Đoạn gốc có thật trong tài liệu không ({@code compactHaystack} = {@link #compact} của toàn văn). Cho phép
     * mô hình bỏ phần giữa bằng "…" / "...": mỗi mảnh (≥ 6 ký tự) phải xuất hiện, theo đúng thứ tự.
     */
    public static boolean excerptFound(String compactHaystack, String excerpt) {
        if (excerpt == null || excerpt.isBlank() || compactHaystack == null) return false;
        int from = 0;
        int pieces = 0;
        for (String part : excerpt.split("…|\\.{3,}")) {
            String p = compact(part);
            if (p.length() < 6) continue;
            int at = compactHaystack.indexOf(p, from);
            if (at < 0) return false;
            from = at + p.length();
            pieces++;
        }
        return pieces > 0;
    }
}
