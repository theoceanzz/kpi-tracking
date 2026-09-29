package com.kpitracking.dto.response.kpi.approval;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Toàn bộ lịch sử duyệt của một KPI: mọi lần gửi chỉ tiêu và mọi yêu cầu điều chỉnh. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiApprovalChainResponse {
    private UUID kpiCriteriaId;
    private String kpiName;
    /** {@code true} khi tổ chức đang dùng chuỗi duyệt; {@code false} = luồng một cấp cũ. */
    private boolean chainMode;
    /** Vị trí hiện tại (nếu đang chờ) — tính cho người đang xem. */
    private ApprovalSummaryResponse current;
    /** Mới nhất trước. */
    private List<ApprovalFlowResponse> flows;
}
