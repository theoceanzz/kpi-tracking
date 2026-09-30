package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
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

    /** Điểm gợi ý trên THANG ĐIỂM ĐÁNH GIÁ (từ V30; lượt cũ ở thang trọng số thô, khi đó {@code maxPoints} null). */
    @Column(name = "suggested_score", precision = 6, scale = 2)
    private BigDecimal suggestedScore;

    /** Điểm tối đa của chỉ tiêu trên thang đánh giá, rồi ba phần chia theo trọng số — xem {@code ReviewScoreCalculator.points}. */
    @Column(name = "max_points", precision = 6, scale = 2)
    private BigDecimal maxPoints;

    @Column(name = "target_points", precision = 6, scale = 2)
    private BigDecimal targetPoints;

    @Column(name = "quality_points", precision = 6, scale = 2)
    private BigDecimal qualityPoints;

    @Column(name = "on_time_points", precision = 6, scale = 2)
    private BigDecimal onTimePoints;

    /** Điểm hệ thống của chỉ tiêu trên cùng thang (tỉ lệ đạt × tối đa) — để so với điểm AI. */
    @Column(name = "system_points", precision = 6, scale = 2)
    private BigDecimal systemPoints;

    /**
     * Chỉ tiêu định tính: điểm nằm trên THANG HÀNH VI riêng (không cộng vào điểm đánh giá 100 của định lượng) —
     * báo cáo lệch AI–quản lý bỏ qua các dòng này.
     */
    @Column(name = "qualitative", nullable = false)
    @Builder.Default
    private Boolean qualitative = false;

    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "gaps", columnDefinition = "TEXT")
    private String gaps;

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;

    /** Lỗi riêng của chỉ tiêu này — một chỉ tiêu lỗi không làm hỏng cả lượt. */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Căn cứ của nhận xét (dòng bộ tiêu chí / đoạn quy chế, kèm đoạn văn gốc) — mảng JSON
     * {@code ReviewResults.Basis}, bản chụp lúc chấm: sửa bộ tiêu chí sau đó không đổi lời giải thích cũ.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basis_citations", columnDefinition = "jsonb")
    private String basisCitations;

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
