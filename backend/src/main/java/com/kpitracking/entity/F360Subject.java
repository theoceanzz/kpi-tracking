package com.kpitracking.entity;

import com.kpitracking.enums.F360SubjectStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/** Một người được đánh giá trong chiến dịch 360, kèm kết quả đã chụp lúc đóng. */
@Entity
@Table(name = "f360_subjects")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private F360Campaign campaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Đơn vị chính CHỤP lúc thêm: chuyển phòng giữa chiến dịch không làm lệch nhóm quan hệ. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id")
    private OrgUnit orgUnit;

    /** Người duyệt đề cử — không bao giờ là chính subject (§5.2). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    private User approver;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private F360SubjectStatus status = F360SubjectStatus.NOMINATING;

    @Column(name = "nomination_submitted_at")
    private Instant nominationSubmittedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "overall_score")
    private Double overallScore;

    @Column(name = "self_score")
    private Double selfScore;

    @Column(name = "response_count")
    private Integer responseCount;

    /** Điểm và chỉ số đã qua ngưỡng ẩn danh — KHÔNG chứa nhận xét (đọc live, §6.4). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_snapshot", columnDefinition = "jsonb")
    private String resultSnapshot;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
