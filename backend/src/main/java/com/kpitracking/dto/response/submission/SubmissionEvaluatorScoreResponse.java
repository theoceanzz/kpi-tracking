package com.kpitracking.dto.response.submission;

import java.time.Instant;
import java.util.UUID;

/**
 * Điểm một chỉ tiêu do một người chấm. Danh sách trả về sắp theo {@code createdAt} (lần chấm đầu): luật cấp bậc buộc
 * cấp sau cao hơn cấp trước, nên người đầu là "Quản lý", người cuối (khác người đầu) là "Sếp".
 *
 * @param managerScore thang trọng số thô, như {@code SubmissionResponse.managerScore}
 */
public record SubmissionEvaluatorScoreResponse(
        UUID submissionId,
        UUID evaluatorId,
        String evaluatorName,
        String evaluatorRoleName,
        Double managerScore,
        UUID qualitativeLevelId,
        String qualitativeLevelName,
        Instant createdAt,
        Instant updatedAt) {}
