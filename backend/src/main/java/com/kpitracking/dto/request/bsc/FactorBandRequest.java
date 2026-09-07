package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscFactorScope;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/** Một dải kết quả → hệ số. Khoảng nửa mở [from, to); null ở hai đầu = vô cùng. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FactorBandRequest {

    @NotNull
    private BscFactorScope scope;

    private Double fromPercent;
    private Double toPercent;

    @NotNull
    private Double factor;

    private String label;
    private String color;
    private Integer displayOrder;
}
