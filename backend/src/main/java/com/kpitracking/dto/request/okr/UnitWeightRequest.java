package com.kpitracking.dto.request.okr;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UnitWeightRequest {
    private UUID orgUnitId;
    private Double weightPercentage;
}
