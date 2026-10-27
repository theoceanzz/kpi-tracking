package com.kpitracking.dto.response.user;

import com.kpitracking.service.kpi.KpiEffortShares;

import lombok.*;

import java.util.UUID;

/** Một nhánh của người kiêm nhiệm kèm "% công sức" hiệu lực (KpiEffortShares). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserEffortShareResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private Double sharePercent;
    /** true = đặt tay; false = chia đều. */
    private boolean configured;
}
