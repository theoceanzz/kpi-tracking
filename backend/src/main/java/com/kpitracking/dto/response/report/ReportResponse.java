package com.kpitracking.dto.response.report;

import com.kpitracking.enums.ReportStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReportResponse {

    private UUID id;
    private String name;
    private String description;
    private ReportStatus status;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID createdById;
    private String createdByName;
    private List<ReportDatasourceResponse> datasources;
    private List<ReportWidgetResponse> widgets;
    private Instant createdAt;
    private Instant updatedAt;
}
