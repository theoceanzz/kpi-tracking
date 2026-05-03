package com.kpitracking.dto.response.report;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.enums.WidgetType;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReportWidgetResponse {

    private UUID id;
    private UUID reportDatasourceId;
    private String datasourceName;
    private WidgetType widgetType;
    private String title;
    private String description;
    private String chartConfig;
    private String position;
    private Integer widgetOrder;

    @JsonProperty("isPinned")
    private boolean isPinned;
}
