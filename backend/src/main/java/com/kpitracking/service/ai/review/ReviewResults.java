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

    /** Phần mô hình trả cho MỘT chỉ tiêu. Ba trường số chỉ để phát hiện mô hình lỡ điền — luôn bị ghi đè. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CriterionAssessment(
            String tomTat,
            Quality chatLuong,
            Double tyLeDapUng,
            Double dungHan,
            Double diemDeXuat,
            List<String> diemManh,
            List<String> canBoSung,
            List<String> goiYChinhSua) {

        /** Mô hình có tự điền con số nào không (luật nói phải để null). */
        public boolean filledNumbers() {
            return tyLeDapUng != null || dungHan != null || diemDeXuat != null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Quality(String muc, String nhanXet, List<String> trichDan) {}

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
            String error) {}
}
