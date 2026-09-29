package com.kpitracking.service.ai.review;

import com.kpitracking.service.ai.review.evidence.EvidenceText;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Dựng khối dữ liệu gửi cho hai agent. Ghép chuỗi bằng mã, KHÔNG qua engine template: chữ nhân viên gõ
 * có thể chứa {@code {{…}}} hoặc lời lệnh, và ở đây nó chỉ là dữ liệu nằm dưới một tiêu đề cố định.
 */
public final class ReviewPrompts {

    /** Ghi vào cột {@code prompt_version} mỗi lượt — đổi prompt thì tăng số để so được trước/sau. */
    public static final String PROMPT_VERSION = "v4";

    /** Trần chữ của khối bộ tiêu chí / trích đoạn quy chế — ngữ cảnh chung, không được lấn phần bài nộp. */
    static final int MAX_SHARED_CHARS = 3500;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.ROOT)
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private ReviewPrompts() {}

    /** Khối cho {@code CriterionReviewAgent}: thang chất lượng, chỉ tiêu, bài nộp. */
    public static String criterionBlock(ReviewContext ctx, ReviewContext.Criterion c) {
        StringBuilder sb = new StringBuilder();
        sb.append("## THANG CHẤT LƯỢNG (chọn đúng một tên, từ kém tới tốt)\n");
        for (ReviewContext.QualityLevel l : ReviewScoreCalculator.scaleOf(ctx)) {
            sb.append("- ").append(l.name());
            if (l.scorePercent() != null) sb.append(" (").append(num(l.scorePercent())).append("%)");
            sb.append('\n');
        }

        sb.append("\n## CHỈ TIÊU\n");
        sb.append("- Tên: ").append(c.name()).append('\n');
        if (c.description() != null && !c.description().isBlank()) sb.append("- Mô tả: ").append(c.description()).append('\n');
        sb.append("- Loại: ").append(c.qualitative() ? "định tính" : "định lượng").append('\n');
        if (!c.qualitative()) {
            if (c.targetValue() != null) sb.append("- Mục tiêu: ").append(num(c.targetValue())).append(unit(c)).append('\n');
            if (c.minimumValue() != null) sb.append("- Ngưỡng tối thiểu: ").append(num(c.minimumValue())).append(unit(c)).append('\n');
            if (c.reverse()) sb.append("- Chỉ tiêu NGƯỢC: càng thấp càng tốt\n");
        }
        sb.append("- Trọng số: ").append(num(c.weight())).append("%\n");
        if (c.deadline() != null) sb.append("- Hạn: ").append(DATE.format(c.deadline())).append('\n');

        appendCriteriaSet(sb, ctx.criteriaSet());
        appendExcerpts(sb, ctx.excerpts());
        appendHistory(sb, c.history());

        sb.append("\n## BÀI NỘP (").append(c.submissions().size()).append(")\n");
        int i = 1;
        for (ReviewContext.Submission s : c.submissions()) {
            sb.append("### Bài ").append(i++);
            if (s.submittedAt() != null) sb.append(" — nộp ").append(DATE.format(s.submittedAt()));
            sb.append('\n');
            if (s.actualValue() != null) sb.append("- Giá trị thực đạt khai: ").append(num(s.actualValue())).append(unit(c)).append('\n');
            if (s.qualitativeLevel() != null) sb.append("- Mức đã chấm trước đó: ").append(s.qualitativeLevel()).append('\n');
            sb.append("- Nội dung nhân viên viết:\n");
            sb.append(s.note() == null || s.note().isBlank() ? "(trống)" : s.note()).append("\n");
            appendEvidence(sb, s);
            sb.append('\n');
        }
        return sb.toString();
    }

    /**
     * Minh chứng của một bài nộp: chữ đã bóc (tin được), chữ chép từ ẢNH (có thể sai — chỉ tham khảo), và
     * tệp không đọc được (ghi tên + lý do để mô hình không giả định nội dung của nó).
     */
    private static void appendEvidence(StringBuilder sb, ReviewContext.Submission s) {
        if (s.attachments().isEmpty()) return;
        if (s.evidence().isEmpty()) {
            sb.append("- Tệp minh chứng (CHƯA đọc nội dung): ").append(String.join(", ", s.attachmentNames())).append('\n');
            return;
        }
        for (EvidenceText e : s.evidence()) {
            if (!e.readable()) {
                sb.append("- Tệp «").append(e.fileName()).append("»: KHÔNG đọc được (").append(e.unreadableReason())
                  .append(") — không được giả định nội dung tệp này\n");
                continue;
            }
            boolean image = e.source() == EvidenceText.Source.IMAGE;
            sb.append("- Nội dung tệp «").append(e.fileName()).append("» ")
              .append(image ? "(CHÉP TỪ ẢNH bằng máy — có thể sai, chỉ tham khảo)" : "(bóc từ tệp)").append(":\n")
              .append(e.text()).append('\n');
        }
    }

    /** Bộ tiêu chí tổ chức đã xác nhận — căn cứ để đánh giá chất lượng. */
    /**
     * Nhóm dòng của bộ tiêu chí đưa vào prompt chấm, theo thứ tự ưu tiên (bị cắt ở cuối khi quá dài).
     * NHIEM_VU không đưa ở đây — bước "regulations" đã trích đúng đoạn nhiệm vụ liên quan từ kho tri thức;
     * THUONG không dùng để chấm bài nộp.
     */
    private static final List<String[]> KIND_HEADINGS = List.of(
            new String[]{"TIEU_CHI", "Căn cứ chấm"},
            new String[]{"THANG_MUC", "Thang xếp loại"},
            new String[]{"THAM_KHAO", "Quy định khác của tổ chức (tham khảo)"});

    /** Bộ tiêu chí đã xác nhận, chia theo loại dòng — căn cứ để chọn mức chất lượng, không phải bài nộp. */
    private static void appendCriteriaSet(StringBuilder sb, ReviewContext.CriteriaSet set) {
        if (set == null || set.rows().isEmpty()) return;
        StringBuilder b = new StringBuilder();
        b.append("\n## BỘ TIÊU CHÍ CHẤM CỦA TỔ CHỨC (").append(set.title()).append(", phiên bản ").append(set.version()).append(")\n");
        for (String[] kh : KIND_HEADINGS) {
            List<ReviewContext.CriteriaRow> rows = set.rows().stream()
                    .filter(r -> kh[0].equals(r.kind() == null ? "TIEU_CHI" : r.kind())).toList();
            if (rows.isEmpty()) continue;
            b.append("### ").append(kh[1]).append('\n');
            for (ReviewContext.CriteriaRow r : rows) {
                b.append("- ").append(r.name());
                if (r.weight() != null) b.append(" (").append(num(r.weight())).append("%)");
                if (r.description() != null && !r.description().isBlank()) b.append(": ").append(r.description());
                b.append('\n');
                if (r.scaleLevels() != null && !r.scaleLevels().isBlank()) {
                    for (String line : r.scaleLevels().split("\n")) b.append("    · ").append(line.strip()).append('\n');
                }
            }
        }
        sb.append(capShared(b.toString()));
    }

    /** Trích đoạn quy chế / mô tả công việc — căn cứ, KHÔNG phải bài nộp (không trích dẫn làm bằng chứng). */
    private static void appendExcerpts(StringBuilder sb, List<ReviewContext.Excerpt> excerpts) {
        if (excerpts == null || excerpts.isEmpty()) return;
        StringBuilder b = new StringBuilder("\n## TRÍCH ĐOẠN QUY CHẾ / MÔ TẢ CÔNG VIỆC CỦA TỔ CHỨC (căn cứ, không phải bài nộp)\n");
        for (ReviewContext.Excerpt e : excerpts) {
            b.append("- [").append(e.document());
            if (e.section() != null && !e.section().isBlank()) b.append(" › ").append(e.section());
            b.append("] ").append(e.text()).append('\n');
        }
        sb.append(capShared(b.toString()));
    }

    /** Lần quản lý đã chấm chỉ tiêu cùng tên ở đợt trước — tham khảo mức thường chấm, không sao chép điểm. */
    private static void appendHistory(StringBuilder sb, List<ReviewContext.HistoryEntry> history) {
        if (history == null || history.isEmpty()) return;
        sb.append("\n## LỊCH SỬ CHẤM CHỈ TIÊU NÀY Ở ĐỢT TRƯỚC (tham khảo mức quản lý thường chấm)\n");
        for (ReviewContext.HistoryEntry h : history) {
            sb.append("- ").append(h.periodName() == null ? "đợt trước" : h.periodName()).append(':');
            if (h.level() != null) sb.append(" mức ").append(h.level()).append(';');
            if (h.managerScore() != null) sb.append(" điểm quản lý ").append(num(h.managerScore())).append(';');
            if (h.reviewNote() != null && !h.reviewNote().isBlank()) sb.append(" nhận xét: ").append(h.reviewNote());
            sb.append('\n');
        }
    }

    private static String capShared(String text) {
        return text.length() <= MAX_SHARED_CHARS ? text : text.substring(0, MAX_SHARED_CHARS) + " …[đã cắt]\n";
    }

    /** Khối cho {@code ReviewSummaryAgent}: kết quả từng chỉ tiêu đã kiểm. */
    public static String summaryDigest(ReviewContext ctx, List<ReviewResults.CriterionResult> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("Đợt: ").append(ctx.periodName() == null ? "(không tên)" : ctx.periodName()).append('\n');
        sb.append("Số chỉ tiêu: ").append(ctx.criteria().size()).append('\n');
        if (ctx.unreadableFiles() != null && !ctx.unreadableFiles().isEmpty()) {
            sb.append("Số tệp minh chứng chưa đọc được: ").append(ctx.unreadableFiles().size()).append('\n');
        }
        if (ctx.conduct() != null && !ctx.conduct().isEmpty()) {
            sb.append("\n## TIÊU CHÍ HẠNH KIỂM CỦA TỔ CHỨC (căn cứ tham khảo — KHÔNG chấm, KHÔNG suy đoán về con người)\n");
            for (ReviewContext.ConductRow r : ctx.conduct()) {
                sb.append("- ").append(r.name());
                if (r.description() != null && !r.description().isBlank()) sb.append(": ").append(r.description());
                sb.append('\n');
            }
        }
        sb.append('\n');
        for (ReviewContext.Criterion c : ctx.criteria()) {
            ReviewResults.CriterionResult r = results.stream()
                    .filter(x -> x.kpiCriteriaId().equals(c.kpiCriteriaId())).findFirst().orElse(null);
            sb.append("## ").append(c.name()).append('\n');
            if (!c.hasSubmission()) {
                sb.append("- CHƯA CÓ BÀI NỘP\n\n");
                continue;
            }
            if (r == null || r.error() != null) {
                sb.append("- Không phân tích được\n\n");
                continue;
            }
            if (r.achievementPercent() != null) sb.append("- % đáp ứng mục tiêu (hệ thống tính): ").append(r.achievementPercent()).append('\n');
            if (r.onTimePercent() != null) sb.append("- % đúng hạn (hệ thống tính): ").append(r.onTimePercent()).append('\n');
            sb.append("- Mức chất lượng: ").append(r.qualityLevel() == null ? "chưa xác định" : r.qualityLevel()).append('\n');
            if (r.summary() != null) sb.append("- Tóm tắt: ").append(r.summary()).append('\n');
            if (r.gaps() != null && !r.gaps().isEmpty()) sb.append("- Còn thiếu: ").append(String.join("; ", r.gaps())).append('\n');
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String unit(ReviewContext.Criterion c) {
        return c.unit() == null || c.unit().isBlank() ? "" : " " + c.unit();
    }

    private static String num(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
