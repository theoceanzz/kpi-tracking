package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Hạn mức token AI theo tháng của một người. Mỗi người đúng một dòng, do đúng một người cấp.
 *
 * <p>{@code allocatedBy} cho biết khoản này trừ vào túi ai:
 * <ul>
 *   <li>{@code null} — cấp từ ngân sách công ty (do quản lý cao nhất phân bổ)</li>
 *   <li>{@code = M} — trừ vào hạn mức của quản lý M</li>
 * </ul>
 */
@Entity
@Table(name = "ai_token_quotas")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiTokenQuota {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "monthly_limit", nullable = false)
    @Builder.Default
    private Long monthlyLimit = 0L;

    @Column(name = "allocated_by")
    private UUID allocatedBy;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
