package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

/** Một đợt KPI mà bộ tiêu chí áp dụng (id + tên để hiển thị). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPeriodResponse {
    private UUID id;
    private String name;
}
