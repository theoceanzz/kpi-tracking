package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** "% công sức" đã CHỐT cho một đợt (V46) — chụp lúc quản lý chấm đợt lần đầu. Đọc qua {@code KpiEffortShares}. */
@Entity
@Table(name = "user_period_effort_shares")
@IdClass(UserPeriodEffortShare.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserPeriodEffortShare {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "kpi_period_id", nullable = false)
    private UUID kpiPeriodId;

    @Id
    @Column(name = "org_unit_id", nullable = false)
    private UUID orgUnitId;

    @Column(name = "share_percent", nullable = false)
    private Double sharePercent;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private UUID userId;
        private UUID kpiPeriodId;
        private UUID orgUnitId;
    }
}
