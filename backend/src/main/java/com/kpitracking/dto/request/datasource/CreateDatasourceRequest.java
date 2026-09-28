package com.kpitracking.dto.request.datasource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateDatasourceRequest {

    @NotBlank(message = "{validation.dataSourceNameCannotEmpty}")
    @Size(max = 255, message = "{validation.nameCanMost255Characters}")
    private String name;

    private String description;

    private String icon;

    private UUID orgUnitId;
}
