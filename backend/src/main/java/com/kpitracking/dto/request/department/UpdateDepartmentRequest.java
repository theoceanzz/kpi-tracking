package com.kpitracking.dto.request.department;

import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateDepartmentRequest {

    @Size(max = 255, message = "Department name must not exceed 255 characters")
    private String name;

    private String description;

    private UUID headId;

    private UUID deputyId;
}
