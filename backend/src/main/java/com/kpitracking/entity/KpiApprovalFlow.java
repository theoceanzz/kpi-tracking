package com.kpitracking.entity;

import com.kpitracking.enums.ApprovalFlowStatus;
import com.kpitracking.enums.ApprovalStepStatus;
import com.kpitracking.enums.ApprovalSubjectType;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Một lần gửi duyệt: chỉ tiêu KPI hoặc yêu cầu điều chỉnh. Chuỗi người duyệt chụp lại vào
 * {@link #steps} ngay lúc gửi — cơ cấu tổ chức đổi sau đó không làm đổi chuỗi đang chạy.
 *
 * <p>{@code @Version} là lớp chặn thứ hai cho việc hai người duyệt cùng lúc; lớp thứ nhất là
 * {@code FOR UPDATE} trên hàng này (xem {@code KpiApprovalFlowRepository#lockById}).
 */
@Entity
@Table(name = "kpi_approval_flows")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiApprovalFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 20)
    private ApprovalSubjectType subjectType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_criteria_id", nullable = false)
    private KpiCriteria kpiCriteria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "adjustment_request_id")
    private KpiAdjustmentRequest adjustmentRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id")
    private User requester;

    @Column(name = "round", nullable = false)
    @Builder.Default
    private int round = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ApprovalFlowStatus status = ApprovalFlowStatus.IN_PROGRESS;

    @Column(name = "current_step_order")
    private Integer currentStepOrder;

    @Column(name = "started_at", nullable = false)
    @Builder.Default
    private Instant startedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @OneToMany(mappedBy = "flow", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    @Builder.Default
    private List<KpiApprovalStep> steps = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    /** Bước đang chờ; rỗng khi flow đã kết thúc. */
    public Optional<KpiApprovalStep> currentStep() {
        if (status != ApprovalFlowStatus.IN_PROGRESS || currentStepOrder == null) return Optional.empty();
        return steps.stream()
                .filter(s -> s.getStepOrder() == currentStepOrder && s.getStatus() == ApprovalStepStatus.PENDING)
                .findFirst();
    }

    /** Bước còn phải duyệt kế tiếp sau {@code order}; các bước đã đánh dấu bỏ qua không tính. */
    public Optional<KpiApprovalStep> nextWaitingAfter(int order) {
        return steps.stream()
                .filter(s -> s.getStepOrder() > order && s.getStatus() == ApprovalStepStatus.WAITING)
                .findFirst();
    }
}
