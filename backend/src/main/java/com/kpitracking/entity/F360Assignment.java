package com.kpitracking.entity;

import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360RaterSource;
import com.kpitracking.enums.F360Relationship;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một phiếu: người chấm × người được đánh giá × quan hệ. Không xoá mềm — gỡ là
 * {@link F360AssignmentStatus#REMOVED}, thêm lại đúng người thì dùng lại dòng này.
 */
@Entity
@Table(name = "f360_assignments")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private F360Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rater_id", nullable = false)
    private User rater;

    @Enumerated(EnumType.STRING)
    @Column(name = "relationship", nullable = false)
    private F360Relationship relationship;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    private F360RaterSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private F360AssignmentStatus status = F360AssignmentStatus.PENDING;

    @Column(name = "decline_reason", columnDefinition = "TEXT")
    private String declineReason;

    @Column(name = "reopen_reason", columnDefinition = "TEXT")
    private String reopenReason;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "last_reminded_at")
    private Instant lastRemindedAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
