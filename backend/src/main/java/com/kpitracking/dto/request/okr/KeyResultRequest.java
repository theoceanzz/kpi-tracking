package com.kpitracking.dto.request.okr;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KeyResultRequest {
    /** Bỏ trống nếu tổ chức bật sinh mã tự động — backend cấp mã theo mẫu của tổ chức. */
    private String code;
    private String name;
    private String description;
    private Double targetValue;
    private Double currentValue;
    private String unit;
    private UUID objectiveId;
    private List<UnitWeightRequest> unitWeights;
}
