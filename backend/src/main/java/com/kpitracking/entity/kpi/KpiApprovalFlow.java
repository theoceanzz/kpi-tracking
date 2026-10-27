package com.kpitracking.entity.kpi;

import com.kpitracking.enums.kpi.ApprovalFlowStatus;
import com.kpitracking.enums.kpi.ApprovalStepStatus;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
/**
 * Một lần gửi duyệt: chỉ tiêu KPI, yêu cầu điều chỉnh, hoặc đối tượng khác có quy trình duyệt
 * ({@link #subjectId}, xem {@code V54__approval_engine_generic.sql}). Chuỗi người duyệt chụp lại vào
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
    @Column(name = "subject_type", nullable = false, length = 30)
    private ApprovalSubjectType subjectType;

    @Column(name = "subject_id")
    private UUID subjectId;

    /** Đơn vị của đối tượng: phạm vi kiểm quyền và tìm người duyệt. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_org_unit_id")
    private OrgUnit subjectOrgUnit;

    @Column(name = "subject_name", length = 500)
    private String subjectName;

    /** Chỉ có ở flow chỉ tiêu / điều chỉnh. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_criteria_id")
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

    /** Quy trình duyệt đã lập ra các bước; {@code null} = chuỗi trưởng đơn vị mặc định. */
    @Column(name = "process_id")
    private UUID processId;

    @Column(name = "process_title")
    private String processTitle;

    /** {@code {graph, pathNodeIds, showInObject}} — sơ đồ lúc gửi và đường đã đi qua nó. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "process_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> processSnapshot;

    /** Đề xuất chờ duyệt (đánh giá, chốt kỳ): áp vào lúc duyệt cuối. Xem {@code V55__approval_flow_payload.sql}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb")
    private Map<String, Object> payload;

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

    /** Flow của chỉ tiêu hoặc điều chỉnh KPI (luật duyệt cuối {@code KPI:APPROVE_FINAL} chỉ áp cho hai loại này). */
    public boolean isKpiSubject() {
        return subjectType == ApprovalSubjectType.CRITERIA || subjectType == ApprovalSubjectType.ADJUSTMENT;
    }

    public OrgUnit unit() {
        return subjectOrgUnit != null ? subjectOrgUnit : kpiCriteria == null ? null : kpiCriteria.getOrgUnit();
    }

    public String displayName() {
        return subjectName != null ? subjectName : kpiCriteria == null ? "" : kpiCriteria.getName();
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
