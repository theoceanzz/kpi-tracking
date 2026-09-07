package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscFactorBasis;
import com.kpitracking.enums.BscFactorMode;
import com.kpitracking.enums.BscLinkedWeightEnforce;
import com.kpitracking.enums.BscPolicyStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadePolicyResponse {
    private UUID id;
    private String name;
    private UUID kpiCycleId;
    private String kpiCycleName;
    private BscFactorMode unitFactorMode;
    private BscFactorMode companyFactorMode;
    private BscFactorBasis factorBasis;
    private Double factorFloor;
    private Double factorCap;
    private Double recognizedCapPercent;
    private Double minBscLinkedWeight;
    private BscLinkedWeightEnforce linkedWeightEnforce;
    private BscPolicyStatus status;
    private Integer version;
    private List<FactorBandResponse> bands;
}
