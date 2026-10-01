package com.kpitracking.service.ai.review;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.UUID;

/**
 * Hình dạng dữ liệu mô hình trả về, và kết quả cuối sau khi đã kiểm. Tên trường tiếng Việt khớp lược đồ
 * JSON trong prompt (tài liệu kế hoạch mục 4.2).
 */
public final class ReviewResults {

    private ReviewResults() {}

    /**
     * Phần mô hình trả cho MỘT chỉ tiêu. Ba trường số chỉ để phát hiện mô hình lỡ điền — luôn bị ghi đè.
     *
     * @param canCu mã căn cứ ("TC2", "QC1") mô hình đã dựa vào — mã nguồn tra ra đoạn gốc, xem {@link ReviewBasis}
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CriterionAssessment(
            String tomTat,
            Quality chatLuong,
            Double tyLeDapUng,
            Double dungHan,
            Double diemDeXuat,
            List<String> diemManh,
            List<String> canBoSung,
            List<String> goiYChinhSua,
            List<String> canCu) {

        public CriterionAssessment(String tomTat, Quality chatLuong, Double tyLeDapUng, Double dungHan,
                                   Double diemDeXuat, List<String> diemManh, List<String> canBoSung,
                                   List<String> goiYChinhSua) {
            this(tomTat, chatLuong, tyLeDapUng, dungHan, diemDeXuat, diemManh, canBoSung, goiYChinhSua, List.of());
        }

        /** Mô hình có tự điền con số nào không (luật nói phải để null). */
        public boolean filledNumbers() {
            return tyLeDapUng != null || dungHan != null || diemDeXuat != null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Quality(String muc, String nhanXet, List<String> trichDan) {}

    /** Phần {@code SubmissionSelfCheckAgent} trả khi nhân viên tự soi bài — không có mức, không có số. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SelfCheckAssessment(
            String tomTat,
            List<String> diemManh,
            List<String> trichDan,
            List<String> canBoSung,
            List<String> goiYChinhSua,
            List<String> canCu) {}

    /** Kết quả tự soi SAU khi kiểm: điểm mạnh chỉ giữ khi có câu trích thật; căn cứ do mã tra. */
    public record SelfCheckResult(
            String summary,
            List<String> evidenceQuotes,
            List<String> strengths,
            List<String> gaps,
            List<String> suggestions,
            List<Basis> basis) {}

    /** Phần mô hình trả cho cả lượt. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Summary(String tomTat, String mucTinCay, List<String> thieuDuLieu) {}

    /**
     * Kết quả một chỉ tiêu SAU khi kiểm — thứ được lưu. Số do mã nguồn tính; chữ đã lọc trích dẫn.
     *
     * @param error lỗi riêng của chỉ tiêu (mô hình lỗi / trả sai định dạng) — lượt vẫn xong
     */
    public record CriterionResult(
            UUID kpiCriteriaId,
            UUID kpiSubmissionId,
            String summary,
            String qualityLevel,
            String qualityComment,
            List<String> evidenceQuotes,
            java.math.BigDecimal achievementPercent,
            java.math.BigDecimal onTimePercent,
            java.math.BigDecimal suggestedScore,
            List<String> strengths,
            List<String> gaps,
            List<String> suggestions,
            String error,
            List<Basis> basis,
            ReviewScoreCalculator.Points points) {

        public CriterionResult(UUID kpiCriteriaId, UUID kpiSubmissionId, String summary, String qualityLevel,
                               String qualityComment, List<String> evidenceQuotes,
                               java.math.BigDecimal achievementPercent, java.math.BigDecimal onTimePercent,
                               java.math.BigDecimal suggestedScore, List<String> strengths, List<String> gaps,
                               List<String> suggestions, String error) {
            this(kpiCriteriaId, kpiSubmissionId, summary, qualityLevel, qualityComment, evidenceQuotes,
                    achievementPercent, onTimePercent, suggestedScore, strengths, gaps, suggestions, error, List.of(),
                    ReviewScoreCalculator.Points.NONE);
        }
    }

    /**
     * Một căn cứ của nhận xét: điều khoản trong bộ tiêu chí hoặc đoạn quy chế trong kho. {@code excerpt} là đoạn văn
     * GỐC do mã nguồn tra theo mã mô hình chọn — mô hình không tự viết đoạn này, nên không bịa được căn cứ.
     *
     * @param kind     {@link ReviewBasis#CRITERIA} (dòng bộ tiêu chí) hoặc {@link ReviewBasis#REGULATION} (đoạn kho)
     * @param title    tên dòng tiêu chí / tên mục trong tài liệu
     * @param source   tên tài liệu (kèm chủ đề) để người đọc biết mở đâu ra đối chiếu
     * @param verified đoạn gốc khớp tài liệu (máy đối chiếu hoặc người duyệt đã xác nhận)
     */
    public record Basis(String ref, String kind, String title, String source, String excerpt, boolean verified) {}
}
