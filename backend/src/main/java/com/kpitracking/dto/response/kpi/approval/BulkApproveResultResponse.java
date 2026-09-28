package com.kpitracking.dto.response.kpi.approval;

import com.kpitracking.enums.ApprovalOutcome;
import lombok.*;

import java.util.UUID;

/** Kết quả từng KPI trong một lượt duyệt hàng loạt — mỗi KPI đi đúng chuỗi của nó. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BulkApproveResultResponse {
    private UUID kpiId;
    private String kpiName;
    private boolean success;
    private ApprovalOutcome outcome;
    /** Người giữ bước kế tiếp khi {@code outcome == FORWARDED}. */
    private String nextHolderNames;
    private String message;
}
