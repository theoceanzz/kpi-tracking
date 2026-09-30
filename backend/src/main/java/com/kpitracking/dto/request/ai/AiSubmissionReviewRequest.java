package com.kpitracking.dto.request.ai;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Nhờ AI đọc trước bài nộp của MỘT nhân viên trong MỘT đợt. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSubmissionReviewRequest {
    @NotNull
    private UUID kpiPeriodId;
    @NotNull
    private UUID userId;
}
