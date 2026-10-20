package com.kpitracking.dto.request.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** "% công sức" theo nhánh của người kiêm nhiệm. Danh sách rỗng = về chia đều. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateEffortSharesRequest {

    @Valid
    @Builder.Default
    private List<Item> shares = new ArrayList<>();

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        @NotNull
        private UUID orgUnitId;

        @NotNull
        @DecimalMin("0") @DecimalMax("100")
        private Double sharePercent;
    }
}
