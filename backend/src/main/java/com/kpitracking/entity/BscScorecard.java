package com.kpitracking.entity;

import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscScorecardApplyScope;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
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

/**
 * Bộ tiêu chí cân bằng (Scorecard) — "Chiến lược" gốc của một tổ chức cho một hoặc nhiều đợt KPI.
 * Giữ các tham số chấm điểm theo kỳ (scoring_mode, empty_perspective_policy) để tái lập điểm lịch sử.
 */
@Entity
@Table(name = "bsc_scorecards")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscScorecard {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /**
     * Các phòng ban (org-unit) mà bộ tiêu chí này áp dụng. Danh sách RỖNG = bộ tiêu chí MẶC ĐỊNH toàn tổ chức.
     * Khi tính điểm cho 1 nhân viên: dùng bộ tiêu chí chứa phòng ban họ → nếu không có thì đi ngược
     * lên phòng ban cha → cuối cùng fallback bộ tiêu chí mặc định org (danh sách rỗng).
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "bsc_scorecard_org_units",
        joinColumns = @JoinColumn(name = "scorecard_id"),
        inverseJoinColumns = @JoinColumn(name = "org_unit_id")
    )
    @Builder.Default
    private List<OrgUnit> orgUnits = new ArrayList<>();

    /**
     * Cách gắn thời gian: theo ĐỢT (chọn nhiều đợt cụ thể) hay theo KỲ (mọi đợt thuộc kỳ).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "apply_scope", nullable = false, length = 20)
    @Builder.Default
    private BscScorecardApplyScope applyScope = BscScorecardApplyScope.PERIOD;

    /**
     * Các đợt áp dụng khi {@code applyScope = PERIOD}. Một bộ tiêu chí có thể dùng cho NHIỀU đợt.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "bsc_scorecard_periods",
        joinColumns = @JoinColumn(name = "scorecard_id"),
        inverseJoinColumns = @JoinColumn(name = "kpi_period_id")
    )
    @Builder.Default
    private List<KpiPeriod> kpiPeriods = new ArrayList<>();

    /**
     * Kỳ đánh giá áp dụng khi {@code applyScope = CYCLE} — mọi đợt thuộc kỳ này đều dùng bộ tiêu chí,
     * kể cả đợt thêm vào kỳ sau khi bộ tiêu chí đã tạo.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "vision", columnDefinition = "TEXT")
    private String vision;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BscScorecardStatus status = BscScorecardStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_mode", nullable = false, length = 20)
    @Builder.Default
    private BscScoringMode scoringMode = BscScoringMode.SHADOW;

    @Enumerated(EnumType.STRING)
    @Column(name = "empty_perspective_policy", nullable = false, length = 20)
    @Builder.Default
    private BscEmptyPerspectivePolicy emptyPerspectivePolicy = BscEmptyPerspectivePolicy.RENORMALIZE;

    @OneToMany(mappedBy = "scorecard", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<BscScorecardPerspective> scorecardPerspectives = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
