package com.kpitracking.entity.task;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Một việc (gốc) trong một danh sách. Nhóm và thứ tự gắn với CẶP (việc, danh sách) — một việc ở nhiều danh sách. */
@Entity
@Table(name = "task_list_items")
@IdClass(TaskListItem.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListItem {

    @Id
    @Column(name = "list_id")
    private UUID listId;

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "section_id")
    private UUID sectionId;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Double sortOrder = 0d;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant addedAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID listId;
        private UUID taskId;
    }
}
