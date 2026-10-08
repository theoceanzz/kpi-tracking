package com.kpitracking.entity;

import com.kpitracking.enums.ApprovalStepKind;
import com.kpitracking.enums.ApprovalStepStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Một bước trong chuỗi duyệt. Người giữ bước nằm ở {@link #approvers}: thường một người, nhiều
 * người khi đơn vị có nhiều trưởng — ai trong nhóm bấm trước thì được.
 */
@Entity
@Table(name = "kpi_approval_steps")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiApprovalStep {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flow_id", nullable = false)
    private KpiApprovalFlow flow;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    @Builder.Default
    private ApprovalStepKind kind = ApprovalStepKind.UNIT_HEAD;

    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    @Column(name = "org_unit_name")
    private String orgUnitName;

    /** Bước lập từ quy trình duyệt ({@code PROCESS_STEP}): tên bước admin đặt, mã "1", "1.1"…, id node trên sơ đồ. */
    @Column(name = "step_name")
    private String stepName;

    @Column(name = "step_code", length = 20)
    private String stepCode;

    @Column(name = "process_node_id", length = 64)
    private String processNodeId;

    /** Các cấp bị gộp vào bước này (một người kiêm trưởng nhiều cấp liên tiếp): [{id, name}]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "merged_units", columnDefinition = "jsonb")
    private List<Map<String, Object>> mergedUnits;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ApprovalStepStatus status;

    @Column(name = "skip_reason", columnDefinition = "TEXT")
    private String skipReason;

    /** Lý do bỏ qua dạng dịch được ({@code LocalizedText} JSON); {@link #skipReason} giữ bản tiếng Việt. */
    @Column(name = "skip_reason_i18n", columnDefinition = "TEXT")
    private String skipReasonI18n;

    @Column(name = "pending_since")
    private Instant pendingSince;

    @Column(name = "last_reminded_at")
    private Instant lastRemindedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acted_by_id")
    private User actedBy;

    @Column(name = "acted_at")
    private Instant actedAt;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "kpi_approval_step_approvers", joinColumns = @JoinColumn(name = "step_id"))
    @Builder.Default
    private List<StepApprover> approvers = new ArrayList<>();

    public boolean isHeldBy(UUID userId) {
        return userId != null && approvers.stream().anyMatch(a -> userId.equals(a.getUserId()));
    }

    /** Tên hiển thị của bước: tên bước của quy trình, hoặc tên đơn vị ở chuỗi mặc định. */
    public String displayName() {
        if (kind == ApprovalStepKind.PROCESS_STEP && stepName != null) {
            return stepCode == null ? stepName : stepCode + " · " + stepName;
        }
        return orgUnitName;
    }

    public String approverNames() {
        return String.join(", ", approvers.stream().map(StepApprover::getUserName).toList());
    }

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class StepApprover {
        @Column(name = "user_id", nullable = false)
        private UUID userId;

        @Column(name = "user_name")
        private String userName;
    }
}
