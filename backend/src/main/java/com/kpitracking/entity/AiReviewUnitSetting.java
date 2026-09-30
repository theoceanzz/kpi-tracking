package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Cấu hình AI đánh giá bài nộp riêng cho MỘT đơn vị (và các đơn vị con không có bản ghi riêng). Không có
 * bản ghi nào trên đường lên gốc thì theo cấu hình công ty; công ty tắt thì mọi đơn vị tắt.
 */
@Entity
@Table(name = "ai_review_unit_settings")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiReviewUnitSetting {

    @Id
    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "weight_target", nullable = false)
    private Integer weightTarget;

    @Column(name = "weight_quality", nullable = false)
    private Integer weightQuality;

    @Column(name = "weight_on_time", nullable = false)
    private Integer weightOnTime;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
