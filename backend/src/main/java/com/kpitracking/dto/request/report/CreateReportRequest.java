package com.kpitracking.dto.request.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateReportRequest {

    @NotBlank(message = "{validation.reportNameCannotEmpty}")
    @Size(max = 255, message = "{validation.nameCanMost255Characters}")
    private String name;

    private String description;

    private UUID orgUnitId;
}
