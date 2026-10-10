package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Chuyển công việc của người gọi từ KPI này sang KPI khác (thường: KPI cũ đã được thay). {@code taskIds} rỗng =
 * mọi việc chưa xong của người gọi ở KPI nguồn.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MoveKpiTasksRequest {

    @NotNull
    private UUID fromKpiId;
    @NotNull
    private UUID toKpiId;
    private List<UUID> taskIds;
}
