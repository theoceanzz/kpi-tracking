package com.kpitracking.dto.request.report;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AddReportDatasourceRequest {

    @NotNull(message = "Datasource ID không được để trống")
    private UUID datasourceId;

    private String alias;
}
