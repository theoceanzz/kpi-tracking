package com.kpitracking.dto.response.conduct;

import lombok.*;

import java.util.UUID;

/** Một tiêu chí hạnh kiểm trong cấu hình của tổ chức. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaResponse {
    private UUID id;
    private String name;
    private String description;
    /** Trọng số %, tổng cả bộ = 100. */
    private Double weight;
    private Integer position;
}
