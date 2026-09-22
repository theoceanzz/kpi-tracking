package com.kpitracking.entity;

import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.CycleUnitEvalStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Đánh giá tổng hợp của một PHÒNG BAN theo một KỲ (đã chốt/nháp).
 * Điểm là snapshot gộp từ điểm kỳ của các nhân viên trong phòng.
 */
@Entity
@Table(name = "cycle_unit_evaluations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id", nullable = false)
    private KpiCycle kpiCycle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation_mode", nullable = false)
    private CycleEvaluationMode evaluationMode;

    @Column(name = "self_score")
    private Double selfScore;

    @Column(name = "manager_score")
    private Double managerScore;

    /** TB mức định tính của thành viên (thang 0..5). */
    @Column(name = "qual_score")
    private Double qualScore;

    /** TB xếp loại ma trận của thành viên (thang 1..5). */
    @Column(name = "matrix_rating")
    private Double matrixRating;

    @Column(name = "member_count")
    private Integer memberCount;

    /**
     * Điểm ĐƠN VỊ do người có quyền chấm tay, thay cho TB thành viên; null = dùng TB tự tính.
     * Giữ riêng khỏi {@code managerScore} (số cuối cùng) để lúc nào cũng đối chiếu được
     * "người chấm cho bao nhiêu" với "trung bình thành viên là bao nhiêu".
     */
    @Column(name = "override_score")
    private Double overrideScore;

    /** Lý do chấm khác TB — bắt buộc nhập, vì số công bố phải giải thích được. */
    @Column(name = "override_reason")
    private String overrideReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "overridden_by")
    private User overriddenBy;

    @Column(name = "overridden_at")
    private Instant overriddenAt;

    /**
     * Xếp loại ĐƠN VỊ (áp luật xếp loại lên phân bố mức của thành viên trong kỳ), CHỤP LẠI lúc chốt.
     * Không tính lại live vì luật xếp loại và đánh giá các đợt cũ đều có thể bị sửa sau khi chốt,
     * làm đổi kết quả đã công bố.
     */
    @Column(name = "classification")
    private String classification;

    @Column(name = "classification_color")
    private String classificationColor;

    /** Tên hồ sơ luật đã áp lúc chốt (null = dùng preset). */
    @Column(name = "classification_profile")
    private String classificationProfile;

    @Column(name = "comment")
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private CycleUnitEvalStatus status = CycleUnitEvalStatus.DRAFT;

    /** Người bấm "chốt dữ liệu kỳ" (DRAFT → CALIBRATING) và thời điểm. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calibrated_by")
    private User calibratedBy;

    @Column(name = "calibrated_at")
    private Instant calibratedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finalized_by")
    private User finalizedBy;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    /**
     * Cấp bậc (level, rank) của người chốt, CHỤP LẠI lúc chốt.
     * Không tính lại live vì người đó có thể được thăng/giáng chức sau khi chốt,
     * làm đổi ý nghĩa của khoá cũ. Dùng để quyết định ai được mở khoá.
     */
    @Column(name = "finalized_role_level")
    private Integer finalizedRoleLevel;

    @Column(name = "finalized_role_rank")
    private Integer finalizedRoleRank;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
