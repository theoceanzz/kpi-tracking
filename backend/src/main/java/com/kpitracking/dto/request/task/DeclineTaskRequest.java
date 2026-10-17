package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.Size;
import lombok.*;

/** Từ chối việc được giao (chỉ việc không KPI). Lý do hiện trong lịch sử và thông báo cho người giao. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DeclineTaskRequest {

    @Size(max = 500)
    private String reason;
}
