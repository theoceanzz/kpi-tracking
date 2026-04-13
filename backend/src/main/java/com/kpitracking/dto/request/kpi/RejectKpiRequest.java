package com.kpitracking.dto.request.kpi;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RejectKpiRequest {

    @NotBlank(message = "Reject reason is required")
    private String reason;
}
