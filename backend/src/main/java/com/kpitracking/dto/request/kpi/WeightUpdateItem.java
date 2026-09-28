package com.kpitracking.dto.request.kpi;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WeightUpdateItem {

    @NotNull(message = "{validation.kpiIdRequired}")
    private UUID kpiId;

    @NotNull(message = "{validation.weightRequired}")
    @Min(value = 0, message = "{validation.weightCannotNegative}")
    @Max(value = 100, message = "{validation.weightCannotExceed100}")
    private Double weight;
}
