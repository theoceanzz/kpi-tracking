package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Uỷ quyền quản lý CHÉO đơn vị.
 *
 * <p>Quyền trong hệ thống chỉ chảy xuống theo cây (xem
 * {@link com.kpitracking.security.PermissionChecker}), nên trưởng đơn vị A không với sang
 * được đơn vị B cùng cấp. Bản ghi này nới PHẠM VI của bộ quyền mà người đó đang có sang
 * đơn vị đích — không cấp thêm quyền mới, không đụng tới ràng buộc mỗi đơn vị một trưởng
 * một phó.
 */
@Entity
@Table(name = "org_unit_delegations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgUnitDelegation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Người được nới quyền. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delegate_user_id", nullable = false)
    private User delegateUser;

    /** Đơn vị ĐÍCH được quản lý. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    /** Đơn vị gốc của người được uỷ quyền — chỉ để hiển thị, không tham gia tính quyền. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_org_unit_id")
    private OrgUnit fromOrgUnit;

    @Column(name = "include_subtree", nullable = false)
    @Builder.Default
    private Boolean includeSubtree = true;

    /**
     * Cho phép ký thay vai trò TRƯỞNG của đơn vị đích. Tách riêng khỏi quyền thường vì
     * hạnh kiểm đòi đúng rank 0 — đây là chữ ký người đứng đầu, không phải quyền thao tác.
     */
    @Column(name = "can_act_as_leader", nullable = false)
    @Builder.Default
    private Boolean canActAsLeader = true;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "starts_at")
    private Instant startsAt;

    /** Bỏ trống = không hết hạn. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Thu hồi = xoá mềm; giữ lại làm dấu vết đối chiếu. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** Đang có hiệu lực tại thời điểm {@code now}. */
    public boolean isActiveAt(Instant now) {
        if (deletedAt != null) return false;
        if (startsAt != null && now.isBefore(startsAt)) return false;
        return expiresAt == null || now.isBefore(expiresAt);
    }
}
