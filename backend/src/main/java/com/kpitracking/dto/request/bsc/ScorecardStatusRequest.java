package com.kpitracking.dto.request.bsc;

import lombok.*;

/** Trả lại BSC cho cấp dưới sửa — lý do là bắt buộc để người nhận biết phải sửa gì. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardStatusRequest {
    private String reason;
}
