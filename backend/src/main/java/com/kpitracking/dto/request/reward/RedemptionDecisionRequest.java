package com.kpitracking.dto.request.reward;

import lombok.Data;

/** Ghi chú kèm khi duyệt, từ chối hoặc đánh dấu đã giao một yêu cầu đổi quà. */
@Data
public class RedemptionDecisionRequest {

    private String note;
}
