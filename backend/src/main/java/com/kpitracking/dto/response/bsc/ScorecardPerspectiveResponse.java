package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPerspectiveResponse {
    private UUID id;
    private UUID perspectiveId;
    private String code;
    private String name;
    private String color;
    private Double weightPercentage;
    private Integer displayOrder;
}
