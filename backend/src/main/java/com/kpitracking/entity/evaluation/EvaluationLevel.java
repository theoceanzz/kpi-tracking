package com.kpitracking.entity.evaluation;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

import com.kpitracking.entity.organization.Organization;
@Entity
@Table(name = "evaluation_levels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Double threshold;

    private String color;
}
