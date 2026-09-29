package com.kpitracking.service.ai.review;

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
 *   <li>Điểm kẹp trong [0, trọng số].</li>
 *   <li>Quá nửa chỉ tiêu không có dữ liệu -> mức tin cậy {@code THAP}.</li>
 * </ul>
 * "Cần bổ sung" và "gợi ý" được giữ không cần trích dẫn: chúng thường nói về thứ KHÔNG có trong bài.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewResultValidator {

    public static final String CONFIDENCE_HIGH = "CAO";
    public static final String CONFIDENCE_MEDIUM = "TRUNG_BINH";
    public static final String CONFIDENCE_LOW = "THAP";

    private static final int MAX_ITEMS = 4;

    private final ReviewScoreCalculator calculator;

    /** Kết quả cho một chỉ tiêu CHƯA có bài nộp — không gọi mô hình, chỉ có số. */
    public ReviewResults.CriterionResult noSubmission(ReviewContext ctx, ReviewContext.Criterion c) {
        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), null,
                "Chưa có bài nộp cho chỉ tiêu này trong đợt.", null, null, List.of(),
                calculator.achievementPercent(c), null,
                calculator.suggestedScore(c, null, ctx.weights()),
                List.of(), List.of("Chưa có bài nộp"), List.of(), null);
    }

    /** Kết quả khi mô hình lỗi / trả sai định dạng cho một chỉ tiêu — vẫn có số, có ghi lỗi. */
    public ReviewResults.CriterionResult failed(ReviewContext ctx, ReviewContext.Criterion c, String error) {
        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), lastSubmissionId(c), null, null, null, List.of(),
                calculator.achievementPercent(c), calculator.onTimePercent(c),
                calculator.suggestedScore(c, null, ctx.weights()),
                List.of(), List.of(), List.of(), error);
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
        String comment = grounded && a.chatLuong() != null ? blankToNull(a.chatLuong().nhanXet()) : null;
        Double qualityPercent = calculator.qualityPercent(level, ReviewScoreCalculator.scaleOf(ctx));

        return new ReviewResults.CriterionResult(c.kpiCriteriaId(), lastSubmissionId(c),
                blankToNull(a.tomTat()), level, comment, quotes,
                calculator.achievementPercent(c), calculator.onTimePercent(c),
                calculator.suggestedScore(c, qualityPercent, ctx.weights()),
                grounded ? cap(a.diemManh()) : List.of(),
                cap(a.canBoSung()), cap(a.goiYChinhSua()), null);
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
