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
 * Bộ câu hỏi 360: các năng lực có trọng số và câu hỏi. Dùng lại qua nhiều chiến dịch; chiến dịch
 * CHỤP câu hỏi lúc launch (f360_campaign_questions) nên sửa bộ này không làm đổi phiếu đã phát.
 */
@Entity
@Table(name = "f360_templates")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Template {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** Thang mỗi câu RATING: 1..scaleMax. */
    @Column(name = "scale_max", nullable = false)
    @Builder.Default
    private Integer scaleMax = 5;

    /**
     * Chiến dịch sở hữu bộ này (bộ được soạn thẳng trong form chiến dịch). Null = bộ mẫu dùng chung
     * của tổ chức. Giữ dạng id chứ không map quan hệ: chiến dịch cũng trỏ ngược về bộ câu hỏi.
     */
    @Column(name = "campaign_id")
    private UUID campaignId;

    /** Bộ dùng sẵn khi tạo chiến dịch mới — mỗi tổ chức đúng một bộ. */
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
