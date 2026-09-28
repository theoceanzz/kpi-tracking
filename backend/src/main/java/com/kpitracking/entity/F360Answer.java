package com.kpitracking.entity;

import com.kpitracking.enums.F360Relationship;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Câu trả lời cho một câu hỏi trên một phiếu. Mang sẵn {@link #subject} + {@link #relationship}
 * để tính điểm mà không cần phiếu — nhờ vậy ở chế độ ẩn danh nghiêm ngặt có thể cắt
 * {@link #assignment} đi mà điểm không đổi (§6.3).
 */
@Entity
@Table(name = "f360_answers")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Answer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private F360Assignment assignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private F360Subject subject;

    @Enumerated(EnumType.STRING)
    @Column(name = "relationship", nullable = false)
    private F360Relationship relationship;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_question_id", nullable = false)
    private F360CampaignQuestion question;

    /** Null với câu TEXT hoặc khi chọn "Không đánh giá được". */
    @Column(name = "score")
    private Double score;

    @Column(name = "is_na", nullable = false)
    @Builder.Default
    private Boolean isNa = false;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "hidden_at")
    private Instant hiddenAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hidden_by")
    private User hiddenBy;

    @Column(name = "hidden_reason", columnDefinition = "TEXT")
    private String hiddenReason;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
