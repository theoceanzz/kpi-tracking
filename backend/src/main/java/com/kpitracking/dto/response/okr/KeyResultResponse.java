package com.kpitracking.dto.response.okr;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KeyResultResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private Double targetValue;
    private Double currentValue;
    private String unit;
    private Double progress; // Calculated as currentValue / targetValue
    private String periodName;
}
