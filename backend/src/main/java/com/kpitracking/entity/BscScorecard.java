package com.kpitracking.entity;

import com.kpitracking.enums.BscEmptyPerspectivePolicy;
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
 * Thẻ điểm cân bằng (Scorecard) — "Chiến lược" gốc của một tổ chức trong một kỳ.
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id", nullable = false)
    private KpiPeriod kpiPeriod;

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
