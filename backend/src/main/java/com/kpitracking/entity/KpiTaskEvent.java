package com.kpitracking.entity;

import com.kpitracking.enums.KpiTaskEventAction;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Lịch sử thay đổi công việc (đổi trạng thái, đổi hạn…). Chỉ ghi thêm. */
@Entity
@Table(name = "kpi_task_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 30)
    private KpiTaskEventAction action;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
