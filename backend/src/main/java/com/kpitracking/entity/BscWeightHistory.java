package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Lịch sử đổi trọng số viễn cảnh trong một thẻ điểm — phục vụ truy vết khi tranh chấp điểm.
 * Ghi lại giá trị cũ/mới + người đổi (audit updated_at thông thường không lưu được).
 */
@Entity
@Table(name = "bsc_weight_history")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscWeightHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scorecard_id", nullable = false)
    private BscScorecard scorecard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perspective_id", nullable = false)
    private BscPerspective perspective;

    @Column(name = "old_weight")
    private Double oldWeight;

    @Column(name = "new_weight")
    private Double newWeight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private User changedBy;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @CreatedDate
    @Column(name = "changed_at", updatable = false)
    private Instant changedAt;
}
