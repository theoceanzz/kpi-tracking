package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Một lĩnh vực trong bộ tiêu chí + trọng số (%). Tổng trọng số = 100 mỗi scorecard.
 * Đây là nơi trọng số "sống" và tham gia vào công thức chấm điểm BSC.
 */
@Entity
@Table(name = "bsc_scorecard_perspectives")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscScorecardPerspective {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scorecard_id", nullable = false)
    private BscScorecard scorecard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perspective_id", nullable = false)
    private BscPerspective perspective;

    @Column(name = "weight_percentage", nullable = false)
    @Builder.Default
    private Double weightPercentage = 0.0;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;
}
