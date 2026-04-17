package com.kpitracking.entity;

import com.kpitracking.enums.PolicyConditionType;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "policy_conditions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PolicyCondition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private Policy policy;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private PolicyConditionType type;

    @Column(name = "condition_json", nullable = false, columnDefinition = "jsonb")
    private String conditionJson;
}
