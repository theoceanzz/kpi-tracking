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
 * Một tiêu chí hạnh kiểm (VD "Trung thực" 25%) nằm trong một {@link ConductCriteriaSet}.
 * Tổ chức thêm/bớt/sửa tự do; bộ mặc định gồm 4 tiêu chí 25% được seed lúc tạo tổ chức.
 */
@Entity
@Table(name = "conduct_criteria")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Bộ chứa tiêu chí này — kỳ dùng bộ nào thì phiếu chấm theo tiêu chí của bộ đó. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conduct_criteria_set_id", nullable = false)
    private ConductCriteriaSet criteriaSet;

    @Column(name = "name", nullable = false)
    private String name;

    /** Các biểu hiện cụ thể của tiêu chí, mỗi dòng một gạch đầu dòng. */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** Trọng số %, tổng của cả bộ phải bằng 100. */
    @Column(name = "weight", nullable = false)
    private Double weight;

    /** Thứ tự hiển thị 1..N ("position" là từ khoá SQL nên dùng position_index). */
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
