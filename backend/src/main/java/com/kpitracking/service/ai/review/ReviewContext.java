package com.kpitracking.service.ai.review;

import com.kpitracking.service.ai.review.evidence.EvidenceText;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Mọi thứ AI được biết khi đọc bài nộp của MỘT nhân viên trong MỘT đợt — đã cắt gọn, chỉ dữ liệu thuần.
 *
 * <p>Không mang entity nào: các agent chạy trên luồng khác (song song), nơi không có Session JPA. Đọc hết
 * ở {@link ReviewContextBuilder} rồi mới gọi mô hình. Các bước sau của luồng (đọc minh chứng, lấy quy chế)
 * làm giàu ngữ cảnh bằng các hàm {@code with…} — record bất biến, mỗi bước trả bản mới.
 *
 * @param unreadableFiles mỗi phần tử "tên tệp: lý do" — tệp minh chứng AI chưa đọc được nội dung
 * @param scale           thang chất lượng (mức định tính) của tổ chức, theo thứ tự hiển thị
 * @param excerpts        trích đoạn quy chế / mô tả công việc liên quan (GĐ2)
 * @param criteriaSet     bộ tiêu chí tổ chức đã xác nhận áp cho người này ({@code null} = chưa có)
 * @param conduct         tiêu chí hạnh kiểm của đợt (rỗng khi tổ chức không bật hạnh kiểm)
 */
public record ReviewContext(
        UUID organizationId,
        UUID kpiPeriodId,
        String periodName,
        UUID userId,
        String userName,
        List<Criterion> criteria,
        List<QualityLevel> scale,
        List<String> unreadableFiles,
        Weights weights,
        List<Excerpt> excerpts,
        CriteriaSet criteriaSet,
        List<ConductRow> conduct) {

    /** Dạng giai đoạn 1 — chưa có quy chế, chưa có bộ tiêu chí. */
    public ReviewContext(UUID organizationId, UUID kpiPeriodId, String periodName, UUID userId, String userName,
                         List<Criterion> criteria, List<QualityLevel> scale, List<String> unreadableFiles,
                         Weights weights) {
        this(organizationId, kpiPeriodId, periodName, userId, userName, criteria, scale, unreadableFiles, weights,
                List.of(), null, List.of());
    }

    /** Gắn chữ đã đọc từ minh chứng vào từng bài nộp; {@code unreadable} là danh sách "tên: lý do" mới. */
    public ReviewContext withEvidence(Map<UUID, List<EvidenceText>> bySubmission, List<String> unreadable) {
        List<Criterion> cs = new ArrayList<>();
        for (Criterion c : criteria) {
            List<Submission> subs = new ArrayList<>();
            for (Submission s : c.submissions()) {
                subs.add(s.withEvidence(bySubmission.getOrDefault(s.id(), List.of())));
            }
            cs.add(c.withSubmissions(subs));
        }
        return new ReviewContext(organizationId, kpiPeriodId, periodName, userId, userName, cs, scale,
                unreadable, weights, excerpts, criteriaSet, conduct);
    }

    public ReviewContext withExcerpts(List<Excerpt> newExcerpts) {
        return new ReviewContext(organizationId, kpiPeriodId, periodName, userId, userName, criteria, scale,
                unreadableFiles, weights, newExcerpts, criteriaSet, conduct);
    }

    /** Một tiêu chí hạnh kiểm của tổ chức — căn cứ tham khảo cho phần tổng hợp, không chấm điểm. */
    public record ConductRow(String name, String description, Double weight) {}

    /** Tổng số tệp minh chứng và số tệp đọc được — ghi vào vết chạy. */
    public int[] fileCounts() {
        int total = 0, read = 0;
        for (Criterion c : criteria) {
            for (Submission s : c.submissions()) {
                total += s.attachments().size();
                read += (int) s.evidence().stream().filter(EvidenceText::readable).count();
            }
        }
        return new int[]{read, total};
    }

    /**
     * Một chỉ tiêu của người đó trong đợt.
     *
     * @param achievementRatio tỉ lệ đạt (0..1.5) do {@code KpiAchievementCalculator} tính — {@code null}
     *                         khi chỉ tiêu không đo được bằng số (định tính chưa chấm mức, thiếu mục tiêu)
     * @param history          các lần quản lý đã chấm chỉ tiêu cùng tên ở những đợt trước (GĐ3)
     */
    public record Criterion(
            UUID kpiCriteriaId,
            String name,
            String description,
            boolean qualitative,
            String unit,
            Double targetValue,
            Double minimumValue,
            boolean reverse,
            double weight,
            Instant deadline,
            Double achievementRatio,
            List<Submission> submissions,
            List<HistoryEntry> history) {

        public Criterion(UUID kpiCriteriaId, String name, String description, boolean qualitative, String unit,
                         Double targetValue, Double minimumValue, boolean reverse, double weight, Instant deadline,
                         Double achievementRatio, List<Submission> submissions) {
            this(kpiCriteriaId, name, description, qualitative, unit, targetValue, minimumValue, reverse, weight,
                    deadline, achievementRatio, submissions, List.of());
        }

        public boolean hasSubmission() {
            return submissions != null && !submissions.isEmpty();
        }

        Criterion withSubmissions(List<Submission> subs) {
            return new Criterion(kpiCriteriaId, name, description, qualitative, unit, targetValue, minimumValue,
                    reverse, weight, deadline, achievementRatio, subs, history);
        }

        /**
         * Mọi chữ thuộc về bài nộp của chỉ tiêu này — phần nhân viên gõ VÀ chữ đọc từ tệp minh chứng — để kiểm
         * trích dẫn của mô hình có thật không.
         */
        public String allNotes() {
            if (submissions == null) return "";
            StringBuilder sb = new StringBuilder();
            for (Submission s : submissions) {
                if (s.note() != null) sb.append(s.note()).append('\n');
                for (EvidenceText e : s.evidence()) {
                    if (e.readable()) sb.append(e.text()).append('\n');
                }
            }
            return sb.toString();
        }
    }

    /** Một bài nộp. {@code note} đã cắt theo {@code app.ai.review.note-max-chars}. */
    public record Submission(
            UUID id,
            String note,
            Double actualValue,
            String qualitativeLevel,
            String status,
            Instant submittedAt,
            List<Attachment> attachments,
            List<EvidenceText> evidence) {

        /** Dạng giai đoạn 1 — chỉ tên tệp, chưa đọc nội dung. */
        public Submission(UUID id, String note, Double actualValue, String qualitativeLevel, String status,
                          Instant submittedAt, List<String> attachmentNames) {
            this(id, note, actualValue, qualitativeLevel, status, submittedAt,
                    attachmentNames == null ? List.of() : attachmentNames.stream().map(n -> new Attachment(n, null)).toList(),
                    List.of());
        }

        public List<String> attachmentNames() {
            return attachments.stream().map(Attachment::fileName).toList();
        }

        Submission withEvidence(List<EvidenceText> texts) {
            return new Submission(id, note, actualValue, qualitativeLevel, status, submittedAt, attachments, texts);
        }
    }

    /** Một tệp minh chứng: tên để hiện, URL để tải. */
    public record Attachment(String fileName, String url) {}

    /** Một lần quản lý đã chấm chỉ tiêu cùng tên ở đợt trước. */
    public record HistoryEntry(String periodName, Double managerScore, String level, String reviewNote) {}

    /** Một trích đoạn quy chế / mô tả công việc. */
    public record Excerpt(String document, String section, String text) {}

    /** Bộ tiêu chí tổ chức đã xác nhận: phiên bản và các dòng. */
    public record CriteriaSet(UUID id, int version, String title, List<CriteriaRow> rows) {}

    /** @param kind TIEU_CHI (căn cứ chấm) · THANG_MUC (thang xếp loại) · THAM_KHAO (quy định liên quan) */
    public record CriteriaRow(String name, String description, Double weight, String scaleLevels, String scope,
                              String kind) {
        public CriteriaRow(String name, String description, Double weight, String scaleLevels, String scope) {
            this(name, description, weight, scaleLevels, scope, "TIEU_CHI");
        }
    }

    /** Một mức trong thang chất lượng của tổ chức. */
    public record QualityLevel(String name, Double scorePercent, int position) {}

    /** Trọng số (%) ba thành phần điểm đề xuất, tổng = 100. */
    public record Weights(int target, int quality, int onTime) {}
}
