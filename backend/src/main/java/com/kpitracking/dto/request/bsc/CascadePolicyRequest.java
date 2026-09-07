package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscFactorBasis;
import com.kpitracking.enums.BscFactorMode;
import com.kpitracking.enums.BscLinkedWeightEnforce;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Chính sách hệ số + bảng dải (QĐ-4, QĐ-8). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadePolicyRequest {

    @NotBlank
    private String name;

    /** Kỳ áp dụng. Bỏ trống = chính sách mặc định của tổ chức. */
    private UUID kpiCycleId;

    private BscFactorMode unitFactorMode;
    private BscFactorMode companyFactorMode;
    private BscFactorBasis factorBasis;

    private Double factorFloor;
    private Double factorCap;
    private Double recognizedCapPercent;

    private Double minBscLinkedWeight;
    private BscLinkedWeightEnforce linkedWeightEnforce;

    /** Toàn bộ dải của cả hai cấp. Gửi lên là thay thế trọn bộ. */
    private List<FactorBandRequest> bands;
}
