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
 * Một lần nhân viên nhờ AI soi bài của MỘT chỉ tiêu trước khi nộp (câu E3 của tài liệu phân tích: "có token thì
 * được dùng").
 *
 * <p>Khác hẳn {@link AiSubmissionReview} của quản lý: chỉ người nộp xem được, KHÔNG có mức chất lượng hay điểm
 * (nhân viên không sửa đi sửa lại tới khi AI cho điểm cao), và không lưu nội dung bài — chỉ băm
 * ({@code inputHash}) để bản y hệt không tốn token lần hai.
 */
@Entity
@Table(name = "ai_self_checks")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiSelfCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    /** Người nộp — cũng là người DUY NHẤT xem được kết quả. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "kpi_criteria_id", nullable = false)
    private UUID kpiCriteriaId;

    /** Bản nháp đang sửa ({@code null} khi soi bài chưa lưu lần nào). */
    @Column(name = "kpi_submission_id")
    private UUID kpiSubmissionId;

    /** SHA-256 của bài (chữ, số, tệp) + bộ tiêu chí + phiên bản prompt. */
    @Column(name = "input_hash", nullable = false, length = 64)
    private String inputHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AiReviewStatus status = AiReviewStatus.QUEUED;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    /** Mỗi dòng một câu trích nguyên văn từ bài (chữ hoặc tệp minh chứng). */
    @Column(name = "evidence_quotes", columnDefinition = "TEXT")
    private String evidenceQuotes;

    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "gaps", columnDefinition = "TEXT")
    private String gaps;

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;

    /** Căn cứ kèm đoạn văn gốc — mảng JSON {@code ReviewResults.Basis}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basis_citations", columnDefinition = "jsonb")
    private String basisCitations;

    /** Mỗi dòng "tên tệp: lý do". */
    @Column(name = "unreadable_files", columnDefinition = "TEXT")
    private String unreadableFiles;

    @Column(name = "files_read")
    private Integer filesRead;

    @Column(name = "files_total")
    private Integer filesTotal;

    @Column(name = "criteria_set_id")
    private UUID criteriaSetId;

    @Column(name = "criteria_set_version")
    private Integer criteriaSetVersion;

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

    /** Chỉ để tra lỗi — giao diện hiện câu dịch sẵn của nó, không hiện cột này. */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
