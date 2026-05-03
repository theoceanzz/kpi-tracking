package com.kpitracking.dto.request.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateReportRequest {

    @NotBlank(message = "Tên báo cáo không được để trống")
    @Size(max = 255, message = "Tên không quá 255 ký tự")
    private String name;

    private String description;

    private UUID orgUnitId;
}
