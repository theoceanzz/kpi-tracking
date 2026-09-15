package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "role_permissions")
// Mọi thay đổi ở đây làm cache quyền của user hết hạn (docs/DATABASE_SCALING.md C2).
@EntityListeners(com.kpitracking.security.AuthorityCacheInvalidator.class)
@IdClass(RolePermission.RolePermissionId.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RolePermission {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class RolePermissionId implements Serializable {
        private UUID role;
        private UUID permission;
    }
}
