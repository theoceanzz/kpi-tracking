package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một bước nhỏ trong checklist của công việc. */
@Entity
@Table(name = "kpi_task_checklist_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "done", nullable = false)
    @Builder.Default
    private Boolean done = false;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
