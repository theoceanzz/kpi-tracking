package com.kpitracking.dto.response.stats;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DeptKpiStatsResponse {

    private UUID departmentId;
    private String departmentName;
    private long totalKpi;
    private long approvedKpi;
    private long pendingKpi;
    private long rejectedKpi;
}
