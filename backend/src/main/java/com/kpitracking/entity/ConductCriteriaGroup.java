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
 * Nhóm tiêu chí hạnh kiểm trong một {@link ConductCriteriaSet} (VD "5 giá trị cốt lõi" 30%). Không bắt
 * buộc: bộ không có nhóm thì tiêu chí nằm phẳng như trước. Có nhóm thì trọng số các nhóm cộng 100%,
 * và trọng số tiêu chí trong MỖI nhóm cộng 100%.
 */
@Entity
@Table(name = "conduct_criteria_groups")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conduct_criteria_set_id", nullable = false)
    private ConductCriteriaSet criteriaSet;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    /** % của nhóm trong tổng 100 của bộ. */
    @Column(name = "weight", nullable = false)
    private Double weight;

    @Column(name = "position_index", nullable = false)
    private Integer position;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
