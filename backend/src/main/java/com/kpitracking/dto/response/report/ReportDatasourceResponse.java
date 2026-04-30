package com.kpitracking.dto.response.report;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReportDatasourceResponse {

    private UUID id;
    private UUID datasourceId;
    private String datasourceName;
    private String alias;
}
