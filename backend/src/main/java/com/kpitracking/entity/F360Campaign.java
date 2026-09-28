package com.kpitracking.entity;

import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360ScoringMode;
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

/**
 * Một chiến dịch đánh giá 360, gắn (tuỳ chọn) với một kỳ KPI.
 *
 * Ba cột JSON ({@link #relationshipWeights}, {@link #raterRules}, {@link #reportSettings}) giữ
 * dạng chuỗi và được đọc qua {@code F360Settings}: cấu hình hay đổi hình, mỗi lần thêm một khoá
 * không đáng một migration.
 */
@Entity
@Table(name = "f360_campaigns")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    /** Chỉ để truy vết — phiếu dùng bản chụp câu hỏi của chiến dịch. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private F360Template template;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private F360CampaignStatus status = F360CampaignStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_mode", nullable = false)
    @Builder.Default
    private F360ScoringMode scoringMode = F360ScoringMode.DEVELOPMENT_ONLY;

    @Column(name = "blend_conduct_percent")
    private Integer blendConductPercent;

    /** Thang điểm CHỤP từ bộ câu hỏi lúc launch. */
    @Column(name = "scale_max", nullable = false)
    @Builder.Default
    private Integer scaleMax = 5;

    /** Ngưỡng k: nhóm ẩn danh có ít hơn k phiếu thì bị gộp/ẩn (§6.1). */
    @Column(name = "anonymity_threshold", nullable = false)
    @Builder.Default
    private Integer anonymityThreshold = 3;

    /** Tách liên kết người chấm ↔ câu trả lời lúc đóng (§6.3). Mặc định bật. */
    @Column(name = "strict_anonymity", nullable = false)
    @Builder.Default
    private Boolean strictAnonymity = true;

    @Column(name = "unlinked_at")
    private Instant unlinkedAt;

    @Column(name = "include_self", nullable = false)
    @Builder.Default
    private Boolean includeSelf = true;

    @Column(name = "manager_anonymous", nullable = false)
    @Builder.Default
    private Boolean managerAnonymous = false;

    @Column(name = "allow_nomination", nullable = false)
    @Builder.Default
    private Boolean allowNomination = false;

    @Column(name = "release_to_subject", nullable = false)
    @Builder.Default
    private Boolean releaseToSubject = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "relationship_weights", nullable = false, columnDefinition = "jsonb")
    private String relationshipWeights;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rater_rules", nullable = false, columnDefinition = "jsonb")
    private String raterRules;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "report_settings", nullable = false, columnDefinition = "jsonb")
    private String reportSettings;

    @Column(name = "nomination_deadline")
    private Instant nominationDeadline;

    /** Ngày mở dự kiến: tới giờ này, nháp đã đủ điều kiện được tự khởi động (F360ReminderScheduler). */
    @Column(name = "start_at")
    private Instant startAt;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "auto_close", nullable = false)
    @Builder.Default
    private Boolean autoClose = true;

    @Column(name = "launched_at")
    private Instant launchedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "released_at")
    private Instant releasedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
