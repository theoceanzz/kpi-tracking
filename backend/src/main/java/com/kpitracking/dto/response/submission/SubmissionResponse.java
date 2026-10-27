package com.kpitracking.dto.response.submission;

import com.kpitracking.enums.submission.SubmissionStatus;
import com.kpitracking.enums.kpi.KpiType;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SubmissionResponse {

    private UUID id;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private KpiType kpiType;
    private Double actualValue;
    private Double targetValue;
    private UUID qualitativeLevelId;
    private String qualitativeLevelName;
    private Double qualitativeLevelValue;
    private String note;
    private SubmissionStatus status;
    private UUID submittedById;
    private String submittedByName;
    private UUID reviewedById;
    private String reviewedByName;
    private String reviewNote;
    private Instant reviewedAt;
    private Instant periodStart;
    private Instant periodEnd;
    private Double autoScore;
    private Double managerScore;
    private String unit;
    private Double weight;
    private KpiPeriodInfo kpiPeriod;
    private List<AttachmentResponse> attachments;
    private UUID parentSubmissionId;
    private Boolean allChildrenApproved;

    // Hoàn duyệt (trả lại để làm lại)
    private UUID returnedById;
    private String returnedByName;
    private Instant returnedAt;
    private String returnReason;
    private Instant resubmitDeadline;
    /** Bài nộp mới thay cho bài bị trả lại này. */
    private UUID resubmissionId;
    /** Bị trả lại, chưa nộp bài mới và chưa quá hạn nộp lại. */
    private boolean awaitingResubmission;
    /** Bài này được nộp để thay cho một bài bị trả lại (bài làm lại). */
    private boolean resubmission;
    /** Lý do người chấm đã trả lại bài trước đó (khi {@code resubmission}). */
    private String previousReturnReason;
    /** Trạng thái chỉ tiêu — {@code INACTIVE} = đã duyệt xin tạm dừng (AI không chấm). */
    private com.kpitracking.enums.kpi.KpiStatus kpiCriteriaStatus;
    /** Chỉ tiêu đang có yêu cầu xin tạm dừng chờ duyệt (AI không chấm). */
    private boolean kpiPausePending;
    /** Bài đang đi quy trình duyệt "Báo cáo kết quả KPI": bước hiện tại, tính cho người đang xem. */
    private com.kpitracking.dto.response.kpi.approval.ApprovalSummaryResponse approval;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KpiPeriodInfo {
        private UUID id;
        private String name;
    }
    private boolean isSubmittedByManager;
    private Instant createdAt;
    private Instant updatedAt;
}
