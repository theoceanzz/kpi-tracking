package com.kpitracking.dto.response.stats;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ExportDetailedPerformanceResponse {
    private UUID userId;
    private String employeeCode;
    private String fullName;
    private String email;
    private String role;
    private String orgUnitName;
    private List<KpiDetailRow> kpis;
    private Double teamLeaderScore;
    private Double deptHeadScore;
    private Double directorScore;
}
