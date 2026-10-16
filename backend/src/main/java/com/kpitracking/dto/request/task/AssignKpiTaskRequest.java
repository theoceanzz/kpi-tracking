package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Giao / giao lại. {@code kpiId} là KPI CỦA người được giao (người đó tạo hoặc thực hiện) — bỏ trống thì giữ KPI hiện
 * tại, chỉ hợp lệ khi người mới cũng thuộc KPI đó.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AssignKpiTaskRequest {

    @NotNull
    private UUID ownerId;
    private UUID kpiId;
    @NotNull
    private Long version;
    /**
     * Đổi KPI mà có người theo dõi (của việc hoặc việc con) không xem được KPI mới thì họ bị gỡ — chỉ khi mọi cặp sẽ gỡ
     * nằm trong danh sách này (lấy từ {@code GET /kpi-tasks/{id}/assign-impact}); có cặp mới chưa xác nhận ⇒ 409.
     */
    private List<FollowerRemovalRef> confirmedFollowerRemovals;
}
