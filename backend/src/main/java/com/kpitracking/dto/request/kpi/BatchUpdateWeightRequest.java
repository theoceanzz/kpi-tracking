package com.kpitracking.dto.request.kpi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BatchUpdateWeightRequest {

    @NotEmpty(message = "{validation.weightUpdateListCannotEmpty}")
    @Valid
    private List<WeightUpdateItem> updates;
}
