package com.kpitracking.entity.user;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.organization.OrgUnit;
@Entity
@Table(name = "user_role_org_units")
// Mọi thay đổi ở đây làm cache quyền của user hết hạn (docs/DATABASE_SCALING.md C2).
@EntityListeners(com.kpitracking.security.AuthorityCacheInvalidator.class)
@IdClass(UserRoleOrgUnit.UserRoleOrgUnitId.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserRoleOrgUnit {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false)
    @Builder.Default
    private Instant assignedAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    /** Uỷ quyền "ký thay trưởng" đã sinh ra vai trò này; null = gán tay. */
    @Column(name = "delegation_id")
    private UUID delegationId;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class UserRoleOrgUnitId implements Serializable {
        private UUID user;
        private UUID role;
        private UUID orgUnit;
    }
}
