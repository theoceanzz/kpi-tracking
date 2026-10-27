package com.kpitracking.dto.request.ai;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Nhờ AI đọc trước bài nộp của MỘT nhân viên trong MỘT đợt — cả phiếu, hoặc chỉ vài chỉ tiêu ({@code kpiCriteriaIds}:
 * nút "Gợi ý" ở một dòng / "Gợi ý tất cả" các dòng còn trống).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSubmissionReviewRequest {
    @NotNull
    private UUID kpiPeriodId;
    @NotNull
    private UUID userId;
    /** Chỉ chấm các chỉ tiêu này; trống = cả phiếu. */
    private List<UUID> kpiCriteriaIds;
    /** Chấm lại kể cả khi bài không đổi (nút "Chấm lại bài này") — vẫn tính tần suất và hạn mức. */
    private Boolean force;
}
