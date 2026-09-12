package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscMeasurementSource;
import lombok.*;

import java.util.UUID;

/** Breakdown một dòng trong kết quả BSC đơn vị. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UnitResultItemResponse {
    private UUID id;
    private UUID scorecardPerspectiveId;
    private String name;
    private String color;
    private Double actualValue;
    private Double targetValue;
    private String unit;
    private Double achievementPercent;
    private Double weightPercentage;
    private Double weightedScore;
    private Integer kpiCount;
    private Boolean isGate;
    private Boolean gatePassed;
    private BscMeasurementSource measurementSource;
}
