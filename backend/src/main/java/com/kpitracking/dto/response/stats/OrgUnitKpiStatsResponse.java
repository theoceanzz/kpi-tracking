package com.kpitracking.dto.response.stats;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgUnitKpiStatsResponse {

    private UUID orgUnitId;
    private String orgUnitName;
    private long memberCount;
    
    private long totalKpi;
    private long approvedKpi;
    private long pendingKpi;
    private long rejectedKpi;
    
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
}
