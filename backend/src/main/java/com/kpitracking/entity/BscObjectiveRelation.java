package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Quan hệ nhân-quả có hướng giữa hai Mục tiêu (Objective) trong bản đồ chiến lược.
 * Thể hiện chuỗi nhân-quả kinh điển của BSC: Học hỏi → Quy trình → Khách hàng → Tài chính.
 */
@Entity
@Table(name = "bsc_objective_relations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscObjectiveRelation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_objective_id", nullable = false)
    private Objective sourceObjective;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_objective_id", nullable = false)
    private Objective targetObjective;

    @Column(name = "label")
    private String label;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
