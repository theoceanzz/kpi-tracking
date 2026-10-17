package com.kpitracking.entity.ai;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Cấu hình AI đánh giá bài nộp riêng cho MỘT đơn vị (và các đơn vị con không có bản ghi riêng). Không có
 * bản ghi nào trên đường lên gốc thì theo cấu hình công ty; công ty tắt thì mọi đơn vị tắt. Từ 13/10 AI không còn
 * trọng số nên một bản ghi chỉ còn nghĩa "đơn vị này tắt AI" (cột weight_* cũ còn trong DB, không dùng).
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

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
