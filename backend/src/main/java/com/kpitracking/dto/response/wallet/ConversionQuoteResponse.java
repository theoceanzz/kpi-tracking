package com.kpitracking.dto.response.wallet;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConversionQuoteResponse {

    private Integer points;

    /** Số đồng đổi được 1 điểm tại thời điểm báo giá. */
    private Long rate;

    /** Số tiền phải trừ = points × rate. Chia chẵn nên không có dư lẻ. */
    private Long cost;

    private Long balanceBefore;
    private Long balanceAfter;

    /** Đủ số dư để thực hiện quy đổi này hay không. */
    private Boolean affordable;

    /** Số điểm tối đa đổi được với số dư hiện tại. */
    private Integer maxPoints;
}
