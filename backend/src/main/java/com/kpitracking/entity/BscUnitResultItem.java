package com.kpitracking.entity;

import com.kpitracking.enums.BscMeasurementSource;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Breakdown một dòng chỉ tiêu trong kết quả BSC đơn vị. Bắt buộc phải có để giải thích được con
 * số tổng — không có nó thì "phòng đạt 92%" là con số không ai kiểm chứng được.
 *
 * <p>Với dòng {@code MANUAL}, {@link #actualValue} chính là ô người phụ trách nhập tay.
 */
@Entity
@Table(name = "bsc_unit_result_items")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscUnitResultItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_result_id", nullable = false)
    private BscUnitResult unitResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scorecard_perspective_id", nullable = false)
    private BscScorecardPerspective scorecardPerspective;

    @Column(name = "actual_value")
    private Double actualValue;

    /** Mục tiêu ĐÃ dùng lúc tính — chụp lại vì dòng chỉ tiêu có thể đổi mục tiêu về sau. */
    @Column(name = "target_value")
    private Double targetValue;

    @Column(name = "achievement_percent")
    private Double achievementPercent;

    @Column(name = "weight_percentage")
    private Double weightPercentage;

    @Column(name = "weighted_score")
    private Double weightedScore;

    @Column(name = "kpi_count", nullable = false)
    @Builder.Default
    private Integer kpiCount = 0;

    @Column(name = "gate_passed")
    private Boolean gatePassed;

    @Enumerated(EnumType.STRING)
    @Column(name = "measurement_source", length = 20)
    private BscMeasurementSource measurementSource;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
