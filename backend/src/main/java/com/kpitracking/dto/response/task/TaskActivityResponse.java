package com.kpitracking.dto.response.task;

import com.kpitracking.enums.task.KpiTaskEventAction;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Một trang của dòng "Hoạt động" (Lark: Activities) — mới nhất trước, `hasMore` để tải tiếp. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskActivityResponse {

    private List<Item> items;
    private boolean hasMore;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        private UUID id;
        private UUID taskId;
        private String taskTitle;
        private KpiTaskEventAction action;
        private String oldValue;
        private String newValue;
        private UUID actorId;
        private String actorName;
        private String actorAvatarUrl;
        private Instant createdAt;
    }
}
