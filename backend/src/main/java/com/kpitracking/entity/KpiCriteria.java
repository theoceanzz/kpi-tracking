package com.kpitracking.entity;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
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
@Table(name = "kpi_criteria")
@SecondaryTable(
    name = "quantitative_kpi_details",
    pkJoinColumns = @PrimaryKeyJoinColumn(name = "kpi_criteria_id")
)
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCriteria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "kpi_criteria_assignees",
        joinColumns = @JoinColumn(name = "kpi_criteria_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @Builder.Default
    private List<User> assignees = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "kpi_type", nullable = false, length = 20)
    @Builder.Default
    private KpiType kpiType = KpiType.QUANTITATIVE;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "weight")
    private Double weight;

    @Column(name = "target_value", table = "quantitative_kpi_details")
    private Double targetValue;

    @Column(name = "unit", table = "quantitative_kpi_details")
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "frequency", nullable = false)
    private KpiFrequency frequency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private KpiStatus status = KpiStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "key_result_id")
    private KeyResult keyResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perspective_id")
    private BscPerspective perspective;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private KpiCriteria parent;

    @Enumerated(EnumType.STRING)
    @Column(name = "parent_relation_type", length = 20)
    private KpiParentRelationType parentRelationType;

    @Column(name = "minimum_value", table = "quantitative_kpi_details")
    private Double minimumValue;

    @Column(name = "compensated_achievement_percent", table = "quantitative_kpi_details")
    private Double compensatedAchievementPercent;

    @Column(name = "is_reverse_kpi", nullable = false, table = "quantitative_kpi_details")
    @Builder.Default
    private Boolean isReverseKpi = false;

    @Column(name = "is_bonus_kpi", nullable = false)
    @Builder.Default
    private Boolean isBonusKpi = false;

    @Column(name = "expected_submissions")
    private Integer expectedSubmissions;

    @Column(name = "deadline")
    private Instant deadline;

    @OneToMany(mappedBy = "kpiCriteria", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<KpiSubmission> submissions = new ArrayList<>();

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    @Builder.Default
    private List<KpiCriteria> children = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaced_by_id")
    private KpiCriteria replacedBy;

    @Column(name = "replacement_reason", columnDefinition = "TEXT")
    private String replacementReason;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Instant getEffectiveDeadline() {
        if (deadline != null) return deadline;
        if (kpiPeriod == null) return null;
        try {
            // kpiPeriod là proxy KHÁC null; nếu đợt đã bị xoá mềm (@SQLRestriction lọc mất row) thì
            // nạp proxy sẽ ném EntityNotFoundException -> coi như KPI không có deadline hiệu lực.
            return kpiPeriod.getEndDate();
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return null;
        }
    }
}
