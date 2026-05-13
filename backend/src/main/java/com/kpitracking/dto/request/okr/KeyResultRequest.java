package com.kpitracking.dto.request.okr;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KeyResultRequest {
    @NotBlank
    private String code;
    private String name;
    private String description;
    private Double targetValue;
    private Double currentValue;
    private String unit;
    private UUID objectiveId;
}
