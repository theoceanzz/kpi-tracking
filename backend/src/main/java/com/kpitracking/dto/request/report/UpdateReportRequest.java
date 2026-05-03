package com.kpitracking.dto.request.report;

import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateReportRequest {

    private String name;
    private String description;
    private String status; // DRAFT, PUBLISHED, ARCHIVED
    private List<UpsertWidgetRequest> widgets;
}
