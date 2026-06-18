package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "key_result_unit_weights")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KeyResultUnitWeight {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "key_result_id", nullable = false)
    private KeyResult keyResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @Column(name = "weight_percentage", nullable = false)
    private Double weightPercentage;
}
