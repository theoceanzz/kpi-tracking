package com.kpitracking.dto.response.conduct;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Một nhóm tiêu chí trong cấu hình; {@code criteria} mang % TRONG NHÓM. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductGroupResponse {
    private UUID id;
    private String name;
    /** % của nhóm trên tổng 100. */
    private Double weight;
    private Integer position;
    /** Tổng % trong nhóm — UI cảnh báo khi khác 100. */
    private Double totalWeight;
    private List<ConductCriteriaResponse> criteria;
}
