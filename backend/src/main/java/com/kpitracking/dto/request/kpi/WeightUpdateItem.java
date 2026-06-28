package com.kpitracking.dto.request.kpi;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WeightUpdateItem {

    @NotNull(message = "KPI ID là bắt buộc")
    private UUID kpiId;

    @NotNull(message = "Trọng số là bắt buộc")
    @Min(value = 0, message = "Trọng số không được âm")
    @Max(value = 100, message = "Trọng số không được vượt quá 100")
    private Double weight;
}
