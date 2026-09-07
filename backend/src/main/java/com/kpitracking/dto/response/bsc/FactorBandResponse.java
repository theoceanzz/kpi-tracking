package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscFactorScope;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FactorBandResponse {
    private UUID id;
    private BscFactorScope scope;
    private Double fromPercent;
    private Double toPercent;
    private Double factor;
    private String label;
    private String color;
    private Integer displayOrder;
}
