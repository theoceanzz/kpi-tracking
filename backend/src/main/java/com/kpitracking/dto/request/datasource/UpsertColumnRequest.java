package com.kpitracking.dto.request.datasource;

import com.kpitracking.enums.ColumnDataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpsertColumnRequest {

    private UUID id; // null = create, present = update

    @NotBlank(message = "{validation.columnNameCannotEmpty}")
    private String name;

    @NotNull(message = "{validation.dataTypeCannotEmpty}")
    private ColumnDataType dataType;

    private Integer columnOrder;

    private Boolean isRequired;

    private String config; // JSON string
}
