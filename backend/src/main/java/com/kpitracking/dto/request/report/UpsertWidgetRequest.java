package com.kpitracking.dto.request.report;

import com.kpitracking.enums.WidgetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpsertWidgetRequest {

    private UUID id; // null = create, present = update

    private UUID reportDatasourceId;

    @NotNull(message = "{validation.widgetTypeCannotEmpty}")
    private WidgetType widgetType;

    @NotBlank(message = "{validation.widgetTitleCannotEmpty}")
    private String title;

    private String description;

    @NotNull(message = "{validation.chartConfigurationCannotEmpty}")
    private String chartConfig; // JSON string

    private String position; // JSON string {x, y, w, h}

    private Integer widgetOrder;
}
