package com.kpitracking.ai.submission.review;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Chốt chặn cuối giữa mô hình và thứ quản lý nhìn thấy.
 *
 * <ul>
 *   <li>Ba con số (% đáp ứng, % đúng hạn, điểm đề xuất) LUÔN là số mã nguồn tính — mô hình điền thì bị
 *       ghi đè và ghi log cảnh báo.</li>
 *   <li>Trích dẫn phải có THẬT trong bài nộp (so sau khi chuẩn hoá khoảng trắng / dấu). Không còn trích
 *       dẫn nào thật thì nhận xét chất lượng, điểm mạnh và MỨC chất lượng đều bị bỏ — nhận định không có
 *       căn cứ không được tới tay quản lý, và mức bị bỏ thì thành phần chất lượng không vào điểm.</li>
 *   <li>Mức chất lượng phải thuộc thang của tổ chức.</li>
 *   <li>Điểm AI = % mức chất lượng × điểm tối đa của thang AI ({@link ReviewScoreCalculator#points}).</li>
 *   <li>Quá nửa chỉ tiêu không có dữ liệu -> mức tin cậy {@code THAP}.</li>
 * </ul>
 * "Cần bổ sung" và "gợi ý" được giữ không cần trích dẫn: chúng thường nói về thứ KHÔNG có trong bài.
 * Căn cứ (điều khoản / đoạn quy chế) do {@link ReviewBasis} tra từ mã mô hình chọn — mã lạ bị bỏ.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewResultValidator {

    public static final String CONFIDENCE_HIGH = "CAO";
    public static final String CONFIDENCE_MEDIUM = "TRUNG_BINH";
    public static final String CONFIDENCE_LOW = "THAP";

    // Mã lý do của mức tin cậy từng chỉ tiêu — giao diện dịch (AiConfidence.reasons.*), không lưu câu dựng sẵn.
    public static final String REASON_ERROR = "ERROR";
    public static final String REASON_NO_SUBMISSION = "NO_SUBMISSION";
    public static final String REASON_NO_QUOTES = "NO_QUOTES";
    public static final String REASON_QUALITY_LOW = "QUALITY_LOW";
    public static final String REASON_QUALITY_MEDIUM = "QUALITY_MEDIUM";
    public static final String REASON_QUALITY_HIGH = "QUALITY_HIGH";

    /**
     * Ngưỡng quy chất lượng AI chấm ra mức tin cậy, theo % của mức trong thang chất lượng của tổ chức (người dùng chốt
     * 07/10): dưới 50 = Thấp, 50–74 = Trung bình, từ 75 = Cao. Thang KÉM 0 · YẾU 20 · TRUNG BÌNH 50 · KHÁ 75 · TỐT 100
     * thì KÉM/YẾU Thấp, TRUNG BÌNH Trung bình, KHÁ/TỐT Cao.
     */
    public static final double QUALITY_MEDIUM_FROM = 50;
    public static final double QUALITY_HIGH_FROM = 75;

    private static final int MAX_ITEMS = 4;

    private final ReviewScoreCalculator calculator;

    /** Kết quả cho một chỉ tiêu CHƯA có bài nộp — không gọi mô hình, chỉ có số. */
    public ReviewResults.CriterionResult noSubmission(ReviewContext ctx, ReviewContext.Criterion c) {
        ReviewScoreCalculator.Points p = calculator.points(ctx, null);
        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), null,
                "Chưa có bài nộp cho chỉ tiêu này trong đợt.", null, null, List.of(),
                calculator.achievementPercent(c), null, p.total(),
                List.of(), List.of("Chưa có bài nộp"), List.of(), null, List.of(), p,
                itemConfidence(ctx, c, null, List.of(), null));
    }

    /** Kết quả khi mô hình lỗi / trả sai định dạng cho một chỉ tiêu — vẫn có số, có ghi lỗi. */
    public ReviewResults.CriterionResult failed(ReviewContext ctx, ReviewContext.Criterion c, String error) {
        ReviewScoreCalculator.Points p = calculator.points(ctx, null);
        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), lastSubmissionId(c), null, null, null, List.of(),
                calculator.achievementPercent(c), calculator.onTimePercent(c), p.total(),
                List.of(), List.of(), List.of(), error, List.of(), p, itemConfidence(ctx, c, null, List.of(), error));
    }

    /** Kiểm và chuẩn hoá phần mô hình trả cho một chỉ tiêu. */
    public ReviewResults.CriterionResult validate(ReviewContext ctx, ReviewContext.Criterion c,
                                                  ReviewResults.CriterionAssessment a) {
        if (a.filledNumbers()) {
            log.warn("Mô hình tự điền số cho chỉ tiêu {} (tyLeDapUng={}, dungHan={}, diemDeXuat={}) — ghi đè bằng số mã nguồn",
                    c.kpiCriteriaId(), a.tyLeDapUng(), a.dungHan(), a.diemDeXuat());
        }

        String haystack = normalize(c.allNotes());
        List<String> quotes = new ArrayList<>();
        if (a.chatLuong() != null && a.chatLuong().trichDan() != null) {
            for (String q : a.chatLuong().trichDan()) {
                if (q != null && !q.isBlank() && haystack.contains(normalize(q))) quotes.add(q.strip());
            }
        }
        boolean grounded = !quotes.isEmpty();
        if (!grounded && a.chatLuong() != null && a.chatLuong().nhanXet() != null) {
            log.info("Bỏ nhận xét chất lượng không có trích dẫn thật cho chỉ tiêu {}", c.kpiCriteriaId());
        }

        String level = grounded && a.chatLuong() != null ? levelInScale(a.chatLuong().muc(), ctx) : null;
        String comment = grounded && a.chatLuong() != null ? prose(ctx, a.chatLuong().nhanXet()) : null;
        Double qualityPercent = calculator.qualityPercent(level, ReviewScoreCalculator.scaleOf(ctx));
        ReviewScoreCalculator.Points p = calculator.points(ctx, qualityPercent);

        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), lastSubmissionId(c),
                prose(ctx, a.tomTat()), level, comment, quotes,
                calculator.achievementPercent(c), calculator.onTimePercent(c), p.total(),
                grounded ? prose(ctx, a.diemManh()) : List.of(),
                prose(ctx, a.canBoSung()), prose(ctx, a.goiYChinhSua()), null,
                // Giữ cả khi nhận xét bị bỏ: căn cứ là chữ gốc do mã tra, vẫn giải thích được "cần bổ sung".
                ReviewBasis.resolve(ctx, a.canCu()), p, itemConfidence(ctx, c, level, quotes, null));
    }

    /**
     * Mức tin cậy riêng của MỘT chỉ tiêu — đi theo CHẤT LƯỢNG bài AI chấm ({@link #qualityConfidence}); kèm số tệp đọc
     * được (đếm trên mọi bài nộp của chỉ tiêu, "đọc được" = có chữ từ tệp).
     *
     * <p>Trước 07/10 luật đo "AI có đủ tư liệu không" (câu trích, tệp, bộ tiêu chí) nên một bài AI chấm KÉM vẫn ra "Cao" —
     * người dùng thấy ngược đời và chốt cho mức tin cậy đi theo chất lượng.
     */
    public ReviewResults.ItemConfidence itemConfidence(ReviewContext ctx, ReviewContext.Criterion c, String level,
                                                       List<String> quotes, String error) {
        int total = 0, read = 0;
        if (c.submissions() != null) {
            for (ReviewContext.Submission s : c.submissions()) {
                total += s.attachments() == null ? 0 : s.attachments().size();
                read += (int) s.evidence().stream().filter(e -> e.readable()).count();
            }
        }
        read = Math.min(read, total);
        // Mức chỉ còn khi có câu trích thật (validate bỏ mức nếu không) — nên không có mức = không chấm được chất lượng.
        Confidence conf = qualityConfidence(level, ReviewScoreCalculator.scaleOf(ctx), error != null, c.hasSubmission());
        return new ReviewResults.ItemConfidence(conf.level(), conf.reasons(), read, total);
    }

    /** Mức tin cậy và mã lý do. */
    public record Confidence(String level, List<String> reasons) {}

    /**
     * Quy chất lượng AI chấm ra mức tin cậy. Dùng cả lúc ghi kết quả lẫn lúc ĐỌC (kết quả cũ chấm theo luật trước vẫn ra
     * đúng mức mới, không phải chấm lại).
     *
     * @param qualityLevel  mức chất lượng AI chọn; {@code null} = AI không chấm được chất lượng (không câu trích khớp)
     * @param scale         thang chất lượng của tổ chức (tên + %)
     * @param error         chỉ tiêu này AI lỗi
     * @param hasSubmission chỉ tiêu có bài nộp
     */
    public static Confidence qualityConfidence(String qualityLevel, List<ReviewContext.QualityLevel> scale,
                                               boolean error, boolean hasSubmission) {
        if (error) return new Confidence(CONFIDENCE_LOW, List.of(REASON_ERROR));
        if (!hasSubmission) return new Confidence(CONFIDENCE_LOW, List.of(REASON_NO_SUBMISSION));
        Double percent = percentOf(qualityLevel, scale);
        if (percent == null) return new Confidence(CONFIDENCE_LOW, List.of(REASON_NO_QUOTES));
        if (percent >= QUALITY_HIGH_FROM) return new Confidence(CONFIDENCE_HIGH, List.of(REASON_QUALITY_HIGH));
        if (percent >= QUALITY_MEDIUM_FROM) return new Confidence(CONFIDENCE_MEDIUM, List.of(REASON_QUALITY_MEDIUM));
        return new Confidence(CONFIDENCE_LOW, List.of(REASON_QUALITY_LOW));
    }

    /** % của mức chất lượng theo tên trong thang (không phân biệt hoa/thường); không có trong thang thì {@code null}. */
    private static Double percentOf(String levelName, List<ReviewContext.QualityLevel> scale) {
        if (levelName == null || scale == null) return null;
        for (ReviewContext.QualityLevel l : scale) {
            if (l.name().equalsIgnoreCase(levelName.strip())) return l.scorePercent();
        }
        return null;
    }

    /** Mức thấp nhất trong các mức (null bị bỏ qua) — mức của lượt chỉ chấm vài chỉ tiêu, hoặc của báo cáo lệch. */
    public static String lowest(java.util.Collection<String> levels) {
        String out = null;
        for (String l : levels) {
            if (l == null) continue;
            if (out == null || rank(l) < rank(out)) out = l;
        }
        return out;
    }

    private static int rank(String level) {
        return switch (level) {
            case CONFIDENCE_LOW -> 0;
            case CONFIDENCE_MEDIUM -> 1;
            default -> 2;
        };
    }

    /**
     * Kiểm phần nhân viên tự soi: cùng luật trích dẫn với luồng quản lý (điểm mạnh không có câu trích thật thì bỏ),
     * còn mức và số thì luồng này không có để kiểm.
     */
    public ReviewResults.SelfCheckResult validateSelfCheck(ReviewContext ctx, ReviewContext.Criterion c,
                                                          ReviewResults.SelfCheckAssessment a) {
        String haystack = normalize(c.allNotes());
        List<String> quotes = new ArrayList<>();
        if (a.trichDan() != null) {
            for (String q : a.trichDan()) {
                if (q != null && !q.isBlank() && haystack.contains(normalize(q))) quotes.add(q.strip());
            }
        }
        boolean grounded = !quotes.isEmpty();
        return new ReviewResults.SelfCheckResult(prose(ctx, a.tomTat()), cap(quotes),
                grounded ? prose(ctx, a.diemManh()) : List.of(),
                prose(ctx, a.canBoSung()), prose(ctx, a.goiYChinhSua()), ReviewBasis.resolve(ctx, a.canCu()));
    }

    /** Chữ mô hình viết (không phải câu trích nguyên văn): mã căn cứ lỡ lọt vào câu đổi thành tên điều khoản. */
    private static String prose(ReviewContext ctx, String text) {
        return blankToNull(ReviewBasis.humanizeRefs(text, ctx));
    }

    private static List<String> prose(ReviewContext ctx, List<String> items) {
        return cap(ReviewBasis.humanizeRefs(items, ctx));
    }

    /** Mức tin cậy cuối: lấy của mô hình (nếu hợp lệ) nhưng hạ xuống THAP khi quá nửa chỉ tiêu thiếu dữ liệu. */
    public String confidence(String modelConfidence, ReviewContext ctx, List<ReviewResults.CriterionResult> results) {
        String conf = switch (modelConfidence == null ? "" : modelConfidence.strip().toUpperCase(Locale.ROOT)) {
            case CONFIDENCE_HIGH -> CONFIDENCE_HIGH;
            case CONFIDENCE_LOW -> CONFIDENCE_LOW;
            default -> CONFIDENCE_MEDIUM;
        };
        int total = ctx.criteria().size();
        if (total == 0) return CONFIDENCE_LOW;
        long withData = results.stream()
                .filter(r -> r.error() == null && r.qualityLevel() != null)
                .count();
        if (withData * 2 < total) return CONFIDENCE_LOW;
        return conf;
    }

    private static UUID lastSubmissionId(ReviewContext.Criterion c) {
        return c.hasSubmission() ? c.submissions().get(c.submissions().size() - 1).id() : null;
    }

    private static String levelInScale(String level, ReviewContext ctx) {
        if (level == null) return null;
        for (ReviewContext.QualityLevel l : ReviewScoreCalculator.scaleOf(ctx)) {
            if (l.name().equalsIgnoreCase(level.strip())) return l.name();
        }
        log.info("Bỏ mức chất lượng '{}' — không có trong thang của tổ chức", level);
        return null;
    }

    private static List<String> cap(List<String> items) {
        if (items == null) return List.of();
        return items.stream().filter(s -> s != null && !s.isBlank()).map(String::strip).limit(MAX_ITEMS).toList();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    /** So trích dẫn không phân biệt hoa/thường, dấu câu thừa và khoảng trắng — mô hình hay xê dịch chút ít. */
    static String normalize(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
        n = n.replaceAll("[\"“”'‘’…]", "").replaceAll("\\s+", " ").strip();
        return n.replaceAll("[.,;:!?]+$", "");
    }
}
