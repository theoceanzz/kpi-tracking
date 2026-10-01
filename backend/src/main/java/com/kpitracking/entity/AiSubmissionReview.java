package com.kpitracking.entity;

import com.kpitracking.enums.AiReviewStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một lượt AI đọc bài nộp của MỘT nhân viên trong MỘT đợt và đề xuất điểm.
 *
 * <p>Chỉ là kết quả THAM KHẢO: điểm chính thức vẫn nằm ở {@code evaluations} / {@code kpi_submissions}
 * và chỉ được ghi khi quản lý bấm ở luồng chấm hiện có. Không có đường nào đi từ bảng này sang đó.
 *
 * <p>Giữ id thay vì quan hệ JPA cho kỳ / người: lượt chạy nền ở luồng khác và chỉ cần id để nạp lại.
 */
@Entity
@Table(name = "ai_submission_reviews")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiSubmissionReview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "kpi_period_id", nullable = false)
    private UUID kpiPeriodId;

    /** Người được phân tích. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Quản lý bấm yêu cầu. */
    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AiReviewStatus status = AiReviewStatus.QUEUED;

    @Column(name = "overall_summary", columnDefinition = "TEXT")
    private String overallSummary;

    /** CAO | TRUNG_BINH | THAP. */
    @Column(name = "confidence", length = 20)
    private String confidence;

    /** Mỗi dòng một thứ còn thiếu để đánh giá chắc chắn hơn. */
    @Column(name = "missing_data", columnDefinition = "TEXT")
    private String missingData;

    /** Mỗi dòng "tên tệp: lý do" — tệp minh chứng AI chưa đọc được nội dung. */
    @Column(name = "unreadable_files", columnDefinition = "TEXT")
    private String unreadableFiles;

    /** Bộ tiêu chí tại thời điểm chấm, để sau này đối chiếu kết quả với đúng dữ liệu đã cấp. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criteria_snapshot", columnDefinition = "jsonb")
    private String criteriaSnapshot;

    /** Phiên bản bộ tiêu chí của tổ chức đã dùng cho lượt này ({@code null} = chưa có bộ nào được xác nhận). */
    @Column(name = "criteria_set_id")
    private UUID criteriaSetId;

    @Column(name = "criteria_set_version")
    private Integer criteriaSetVersion;

    /** Số tệp minh chứng đọc được / tổng số tệp — để đo tỷ lệ đọc được (nghiệm thu GĐ2 ≥ 90 %). */
    @Column(name = "files_read")
    private Integer filesRead;

    @Column(name = "files_total")
    private Integer filesTotal;

    @Column(name = "model_name", length = 120)
    private String modelName;

    @Column(name = "prompt_version", length = 20)
    private String promptVersion;

    @Column(name = "prompt_tokens")
    private Integer promptTokens;

    @Column(name = "completion_tokens")
    private Integer completionTokens;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
