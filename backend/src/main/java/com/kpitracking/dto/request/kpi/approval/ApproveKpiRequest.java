package com.kpitracking.dto.request.kpi.approval;

import lombok.*;

import java.util.UUID;

/**
 * Thân (tuỳ chọn) của lệnh duyệt. {@code expectedStepId} là bước mà người dùng đang nhìn thấy:
 * nếu trong lúc đó chuỗi đã đi tiếp (người khác vừa duyệt) thì trả 409 thay vì duyệt nhầm bước.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApproveKpiRequest {
    private UUID expectedStepId;
    private String comment;
}
