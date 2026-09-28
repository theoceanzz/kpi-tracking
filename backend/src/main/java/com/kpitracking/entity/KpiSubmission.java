package com.kpitracking.entity;

import com.kpitracking.enums.SubmissionStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "kpi_submissions")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_criteria_id", nullable = false)
    private KpiCriteria kpiCriteria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by", nullable = false)
    private User submittedBy;

    @Column(name = "actual_value")
    private Double actualValue;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SubmissionStatus status = SubmissionStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "period_start")
    private Instant periodStart;

    @Column(name = "period_end")
    private Instant periodEnd;

    @Column(name = "auto_score")
    private Double autoScore;

    @Column(name = "manager_score")
    private Double managerScore;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "qualitative_level_id")
    private QualitativeLevel qualitativeLevel;

    // ── Hoàn duyệt (trả lại để làm lại) — xem KpiSubmissionService#returnSubmission ──

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "returned_by")
    private User returnedBy;

    @Column(name = "returned_at")
    private Instant returnedAt;

    @Column(name = "return_reason", columnDefinition = "TEXT")
    private String returnReason;

    /** Hạn nộp lại. Trước hạn này nhân viên nộp được bài mới cho KPI dù đợt đã hết hạn. */
    @Column(name = "resubmit_deadline")
    private Instant resubmitDeadline;

    /** Bài nộp mới thay cho bài bị trả lại này; {@code null} = đang chờ nộp lại. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resubmission_id")
    private KpiSubmission resubmission;

    /** Bị trả lại và vẫn đang chờ nhân viên nộp bài mới (chưa nộp, chưa quá hạn). */
    public boolean isAwaitingResubmission(Instant now) {
        return status == SubmissionStatus.RETURNED && resubmission == null
                && resubmitDeadline != null && !now.isAfter(resubmitDeadline);
    }

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SubmissionAttachment> attachments = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
