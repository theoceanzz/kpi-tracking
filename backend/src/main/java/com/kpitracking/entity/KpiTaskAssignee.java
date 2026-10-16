package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Một người thực hiện của công việc (V42). {@code KpiTask.owner} là người CHÍNH và luôn có một dòng ở đây.
 * {@link #completedAt}: phần của người này đã xong (kiểu hoàn thành ALL; ANY thì ghi cho người đã tích).
 */
@Entity
@Table(name = "kpi_task_assignees")
@IdClass(KpiTaskAssignee.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskAssignee {

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant addedAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID taskId;
        private UUID userId;
    }
}
