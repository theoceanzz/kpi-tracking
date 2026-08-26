package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Một BỘ tiêu chí hạnh kiểm, gán cho (các) kỳ đánh giá.
 *
 * Cùng khuôn với hồ sơ luật của "xếp loại đơn vị": tổ chức có nhiều bộ, kỳ nào được gán
 * thì dùng bộ đó, kỳ còn lại rơi về bộ {@link #isDefault}. Nhờ vậy dựng bộ tiêu chí cho
 * kỳ mới không phải viết đè lên bộ mà các kỳ cũ đang dùng.
 */
@Entity
@Table(name = "conduct_criteria_sets")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaSet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name;

    /** Bộ áp cho mọi kỳ chưa được gán bộ riêng — mỗi tổ chức đúng một bộ như vậy. */
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    /** Thang điểm mỗi tiêu chí của riêng bộ này (đổi thang giữa hai kỳ là chuyện thường). */
    @Column(name = "max_score", nullable = false)
    @Builder.Default
    private Double maxScore = 4.0;

    /**
     * Các kỳ đang dùng bộ này. Là {@code @ElementCollection} chứ không phải entity riêng vì
     * bảng nối chỉ có đúng hai cột và không bao giờ được tra ngược từ phía kỳ.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "conduct_criteria_set_cycles",
            joinColumns = @JoinColumn(name = "conduct_criteria_set_id"))
    @Column(name = "kpi_cycle_id", nullable = false)
    @Builder.Default
    private Set<UUID> kpiCycleIds = new LinkedHashSet<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
