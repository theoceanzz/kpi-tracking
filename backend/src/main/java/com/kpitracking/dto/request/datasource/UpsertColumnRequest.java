package com.kpitracking.dto.request.datasource;

import com.kpitracking.enums.ColumnDataType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpsertColumnRequest {

    private UUID id; // null = create, present = update

    @NotBlank(message = "Tên cột không được để trống")
    private String name;

    @NotNull(message = "Kiểu dữ liệu không được để trống")
    private ColumnDataType dataType;

    private Integer columnOrder;

    private Boolean isRequired;

    private String config; // JSON string
}
