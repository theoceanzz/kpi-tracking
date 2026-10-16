package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Gắn / đổi / gỡ KPI của việc gốc (cả cây đi theo). {@code kpiId = null} = gỡ KPI. Gắn / đổi chạy lại toàn bộ luật giao
 * việc trên KPI đích; người theo dõi không xem được KPI đích bị gỡ khi đã xác nhận (lấy từ {@code kpi-impact}).
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SetTaskKpiRequest {

    private UUID kpiId;
    @NotNull
    private Long version;
    private List<FollowerRemovalRef> confirmedFollowerRemovals;
}
