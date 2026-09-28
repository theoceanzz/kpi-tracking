package com.kpitracking.dto.request.kpi.approval;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BulkApproveKpiRequest {

    @NotEmpty(message = "{validation.noKpiSelected}")
    @Valid
    private List<Item> items;

    private String comment;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        @NotNull
        private UUID kpiId;
        private UUID expectedStepId;
    }
}
