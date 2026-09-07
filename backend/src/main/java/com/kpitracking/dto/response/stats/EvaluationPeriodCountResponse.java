package com.kpitracking.dto.response.stats;

import lombok.*;

import java.util.UUID;

/** Số phiếu đánh giá thuộc một đợt KPI — dùng cho thẻ thống kê ở dashboard. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationPeriodCountResponse {

    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private long count;
}
