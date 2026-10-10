package com.kpitracking.dto.request.task;

import com.kpitracking.enums.KpiTaskStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/** Đổi trạng thái (kéo thả Kanban). {@code sortOrder} = vị trí mới trong cột (tuỳ chọn). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChangeKpiTaskStatusRequest {

    @NotNull
    private KpiTaskStatus status;
    private Double sortOrder;
    @NotNull
    private Long version;
    /** Hoàn thành dù còn việc con chưa xong (người dùng đã xác nhận). */
    private boolean force;
}
