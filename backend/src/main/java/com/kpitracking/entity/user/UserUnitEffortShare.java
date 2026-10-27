package com.kpitracking.entity.user;

import com.kpitracking.service.kpi.KpiEffortShares;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** "% công sức" của một người ở một nhánh đơn vị khi kiêm nhiệm (V46) — đọc qua {@code KpiEffortShares}. */
@Entity
@Table(name = "user_unit_effort_shares")
@IdClass(UserUnitEffortShare.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserUnitEffortShare {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "org_unit_id", nullable = false)
    private UUID orgUnitId;

    @Column(name = "share_percent", nullable = false)
    private Double sharePercent;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private UUID userId;
        private UUID orgUnitId;
    }
}
