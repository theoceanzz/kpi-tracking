package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "role_policies")
@IdClass(RolePolicy.RolePolicyId.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RolePolicy {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private Policy policy;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class RolePolicyId implements Serializable {
        private UUID role;
        private UUID policy;
    }
}
