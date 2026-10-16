package com.kpitracking.dto.request.task;

import lombok.*;

import java.util.UUID;

/** Thân request của các thao tác cấu trúc trong menu ··· (Đặt việc cha, Đánh dấu mốc). */
public final class TaskStructureRequests {

    private TaskStructureRequests() {
    }

    /** {@code parentTaskId} null = chuyển thành việc độc lập. */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Parent {
        private UUID parentTaskId;
        private Long version;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Milestone {
        private boolean milestone;
        private Long version;
    }
}
