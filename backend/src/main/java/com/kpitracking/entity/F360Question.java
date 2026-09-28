package com.kpitracking.entity;

import com.kpitracking.enums.F360QuestionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/** Một câu hỏi trong bộ câu hỏi 360. */
@Entity
@Table(name = "f360_questions")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private F360Template template;

    /** Null = câu mở chung, không thuộc năng lực nào. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competency_id")
    private F360Competency competency;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false)
    private F360QuestionType questionType;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    /** Nhóm quan hệ được hỏi câu này, CSV tên enum. Null = hỏi mọi nhóm. */
    @Column(name = "relationships")
    private String relationships;

    @Column(name = "required", nullable = false)
    @Builder.Default
    private Boolean required = true;

    @Column(name = "allow_na", nullable = false)
    @Builder.Default
    private Boolean allowNa = true;

    @Column(name = "position_index", nullable = false)
    private Integer position;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
