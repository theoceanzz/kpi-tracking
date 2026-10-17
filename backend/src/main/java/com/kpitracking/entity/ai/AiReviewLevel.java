package com.kpitracking.entity.ai;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Một mức của THANG ĐIỂM AI (V51, 13/10): AI chọn một mức cho chất lượng bài nộp, điểm AI = {@link #points} của mức,
 * điểm tối đa = điểm của mức cao nhất. Thang riêng của AI, tách khỏi thang định tính của KPI; một thang cho cả công ty.
 * {@link #description} đi vào lời nhắc để AI hiểu mức đó nghĩa là gì.
 */
@Entity
@Table(name = "ai_review_levels")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiReviewLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "points", nullable = false, precision = 6, scale = 2)
    private BigDecimal points;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
