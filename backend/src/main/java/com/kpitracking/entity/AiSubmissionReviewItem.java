package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Kết quả AI cho MỘT chỉ tiêu trong một lượt {@link AiSubmissionReview}.
 *
 * <p>Ba cột số ({@code achievementPercent}, {@code onTimePercent}, {@code suggestedScore}) do MÃ NGUỒN
 * tính — {@code ReviewResultValidator} ghi đè bất cứ thứ gì mô hình điền. Các cột chữ nhiều dòng lưu
 * mỗi ý một dòng.
 */
@Entity
@Table(name = "ai_submission_review_items")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiSubmissionReviewItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "review_id", nullable = false)
    private UUID reviewId;

    /** NULL = chỉ tiêu chưa có bài nộp. */
    @Column(name = "kpi_submission_id")
    private UUID kpiSubmissionId;

    @Column(name = "kpi_criteria_id", nullable = false)
    private UUID kpiCriteriaId;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "quality_comment", columnDefinition = "TEXT")
    private String qualityComment;

    @Column(name = "quality_level", length = 40)
    private String qualityLevel;

    @Column(name = "evidence_quotes", columnDefinition = "TEXT")
    private String evidenceQuotes;

    @Column(name = "achievement_percent", precision = 6, scale = 2)
    private BigDecimal achievementPercent;

    @Column(name = "on_time_percent", precision = 6, scale = 2)
    private BigDecimal onTimePercent;

    @Column(name = "suggested_score", precision = 6, scale = 2)
    private BigDecimal suggestedScore;

    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "gaps", columnDefinition = "TEXT")
    private String gaps;

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;

    /** Lỗi riêng của chỉ tiêu này — một chỉ tiêu lỗi không làm hỏng cả lượt. */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "manager_score", precision = 6, scale = 2)
    private BigDecimal managerScore;

    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;

    @Column(name = "manager_changed", nullable = false)
    @Builder.Default
    private Boolean managerChanged = false;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;
}
