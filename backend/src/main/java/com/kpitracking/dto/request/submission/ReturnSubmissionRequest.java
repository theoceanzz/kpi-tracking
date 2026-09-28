package com.kpitracking.dto.request.submission;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;

/** Trả lại (hoàn duyệt) một bài nộp để nhân viên làm lại bằng bài nộp mới. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReturnSubmissionRequest {

    @NotBlank(message = "{validation.enterReturnReason}")
    private String reason;

    /** Hạn nộp lại. Trước hạn này nhân viên được nộp bài mới cho KPI dù đợt đã hết hạn. */
    @NotNull(message = "{validation.resubmitDeadlineRequired}")
    private Instant resubmitDeadline;
}
