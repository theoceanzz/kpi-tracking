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

    @NotNull(message = "Loại widget không được để trống")
    private WidgetType widgetType;

    @NotBlank(message = "Tiêu đề widget không được để trống")
    private String title;

    private String description;

    @NotNull(message = "Cấu hình biểu đồ không được để trống")
    private String chartConfig; // JSON string

    private String position; // JSON string {x, y, w, h}

    private Integer widgetOrder;
}
