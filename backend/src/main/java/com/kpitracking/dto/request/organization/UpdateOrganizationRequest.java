package com.kpitracking.dto.request.organization;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateOrganizationRequest {

    @Size(max = 255, message = "Organization name must not exceed 255 characters")
    private String name;

    private String status;
}
