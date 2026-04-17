package com.kpitracking.dto.request.policy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreatePolicyRequest {

    @NotNull(message = "Org Unit ID is required")
    private UUID orgUnitId;

    @NotBlank(message = "Policy name is required")
    private String name;

    @NotBlank(message = "Effect is required (ALLOW or DENY)")
    private String effect;
}
