package com.kpitracking.dto.response.task;

import lombok.*;

import java.util.UUID;

/** KPI cũ (đã được thay bằng KPI đang xem) còn việc chưa xong của người gọi — để hỏi có chuyển sang không. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskReplacementResponse {

    private UUID oldKpiId;
    private String oldKpiName;
    private UUID newKpiId;
    private String newKpiName;
    private long openTaskCount;
}
