package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.NotNull;
import lombok.*;

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
}
