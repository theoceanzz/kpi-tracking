package com.kpitracking.dto.request.kpi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BatchUpdateWeightRequest {

    @NotEmpty(message = "Danh sách cập nhật trọng số không được trống")
    @Valid
    private List<WeightUpdateItem> updates;
}
