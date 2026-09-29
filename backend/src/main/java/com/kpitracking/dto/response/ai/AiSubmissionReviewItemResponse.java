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
}
