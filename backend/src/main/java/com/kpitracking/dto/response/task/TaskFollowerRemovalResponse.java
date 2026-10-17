package com.kpitracking.dto.response.task;

import lombok.*;

import java.util.UUID;

/** Người theo dõi sẽ bị gỡ khỏi một việc (việc cha hoặc việc con) vì việc chuyển sang KPI người đó không xem được. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskFollowerRemovalResponse {

    private UUID taskId;
    private String taskTitle;
    private boolean subtask;
    private UUID userId;
    private String userName;
    private String avatarUrl;
}
