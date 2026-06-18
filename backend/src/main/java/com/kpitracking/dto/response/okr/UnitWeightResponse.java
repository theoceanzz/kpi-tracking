package com.kpitracking.dto.response.okr;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UnitWeightResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private Double weightPercentage;
}
