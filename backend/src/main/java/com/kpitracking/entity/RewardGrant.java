package com.kpitracking.entity;

import com.kpitracking.enums.RewardApprovalMode;
import com.kpitracking.enums.RewardGrantStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Một lần sếp chủ động trao điểm cho một hoặc nhiều nhân viên.
 *
 * <p>Trong hạn mức ngân sách ⇒ APPROVED ngay khi tạo ({@code approvalMode = AUTO}).
 * Vượt hạn mức hoặc vượt {@code maxPerAward} ⇒ PENDING_APPROVAL, chờ người có
 * quyền {@code REWARD:APPROVE}. Không có ngân sách cũng rơi vào nhánh chờ duyệt —
 * fail closed, "chưa được cấp hạn mức" không có nghĩa là "không giới hạn".
 *
 * <p>Khoản được duyệt vượt hạn mức có {@link #budget} = null: đó là ngoại lệ do cấp
 * trên cho, không phải quyết định trong thẩm quyền của người trao, nên không tính
 * vào hạn mức cá nhân của họ.
 */
@Entity
@Table(name = "reward_grants")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardGrant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Đơn vị dùng để xác định ai có quyền duyệt đề nghị này. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grantor_user_id", nullable = false)
    private User grantor;

    /** Null khi đề nghị được duyệt vượt hạn mức — xem javadoc của class. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "budget_id")
    private RewardBudget budget;

    /** Giá trị mặc định của giao diện; số điểm có thẩm quyền nằm ở từng {@link RewardGrantItem}. */
    @Column(name = "points_per_recipient")
    private Integer pointsPerRecipient;

    /** Chốt cứng lúc gửi = tổng điểm của các item. Là cơ sở tính hạn mức đã dùng. */
    @Column(name = "total_points", nullable = false)
    private Integer totalPoints;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private RewardGrantStatus status = RewardGrantStatus.PENDING_APPROVAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_mode", nullable = false, length = 10)
    @Builder.Default
    private RewardApprovalMode approvalMode = RewardApprovalMode.MANUAL;

    /** Vì sao phải qua duyệt, hiện nguyên văn cho người trao đọc. */
    @Column(name = "approval_reason", columnDefinition = "TEXT")
    private String approvalReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_user_id")
    private User approver;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    /**
     * Người trao có kèm giấy khen cho lần thưởng này không.
     *
     * <p>Là quyết định riêng, không suy ra từ số điểm hay trạng thái: thưởng 10 điểm vì
     * đi họp đúng giờ mà cũng sinh ra tờ "Cống hiến xuất sắc" thì giấy khen mất giá trị.
     * Nhân viên chỉ thấy chứng nhận của những lượt được bật cờ này.
     */
    @Column(name = "certificate_enabled", nullable = false)
    @Builder.Default
    private Boolean certificateEnabled = false;

    /**
     * Mẫu chứng nhận người trao đã chọn. Null = để hệ thống dùng mẫu mặc định của công ty
     * lúc in — công ty đổi mẫu mặc định thì các lượt chưa in đi theo mẫu mới.
     *
     * <p>Giữ id thay vì đối tượng: mẫu bị xoá mềm vẫn còn dòng trong bảng nên
     * {@code @ManyToOne} sẽ nạp ra một thực thể bị {@code @SQLRestriction} chặn và ném lỗi
     * giữa lúc dựng phản hồi. Tầng hiển thị tra không ra mẫu thì tự lùi về mẫu mặc định.
     */
    @Column(name = "certificate_template_id")
    private UUID certificateTemplateId;

    @OneToMany(mappedBy = "grant", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RewardGrantItem> items = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
