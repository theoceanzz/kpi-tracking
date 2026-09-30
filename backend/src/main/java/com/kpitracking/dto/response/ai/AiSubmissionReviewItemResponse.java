package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Kết quả AI cho một chỉ tiêu. Ba con số ({@code achievementPercent}, {@code onTimePercent},
 * {@code suggestedScore}) do mã nguồn tính, không phải mô hình.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSubmissionReviewItemResponse {
    private UUID id;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private Double weight;
    private UUID kpiSubmissionId;
    private String summary;
    private String qualityLevel;
    private String qualityComment;
    private List<String> evidenceQuotes;
    private BigDecimal achievementPercent;
    private BigDecimal onTimePercent;
    private BigDecimal suggestedScore;
    private List<String> strengths;
    private List<String> gaps;
    private List<String> suggestions;
    private String errorMessage;
    /** Căn cứ (điều khoản / đoạn quy chế) kèm đoạn văn gốc — rỗng với lượt chấm trước khi có tính năng này. */
    private List<AiReviewBasisResponse> basis;

    // ── Điểm gợi ý trên THANG ĐIỂM ĐÁNH GIÁ, chia ba phần (null với lượt cũ / chỉ tiêu định tính) ──
    private BigDecimal maxPoints;
    private BigDecimal targetPoints;
    private BigDecimal qualityPoints;
    private BigDecimal onTimePoints;
    private BigDecimal systemPoints;

    // ── Số để giao diện dựng lý do từng phần (điền lúc đọc, không lưu) ──
    /** Chỉ tiêu định tính: điểm nằm trên THANG HÀNH VI riêng (không cộng vào điểm đánh giá 100). */
    private Boolean qualitative;
    private Double targetValue;
    private String unit;
    /** Giá trị thực đạt khai ở bài nộp mới nhất của chỉ tiêu. */
    private Double actualValue;
    /** Định tính: mức người nộp tự đánh giá ở bài mới nhất. */
    private String selfLevel;
    /** Định tính: mức gần nhất với điểm AI gợi ý trên thang hành vi. */
    private String suggestedLevel;
}
