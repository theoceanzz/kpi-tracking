package com.kpitracking.entity;

import com.kpitracking.enums.KpiTaskReminderKind;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một mốc nhắc của công việc. {@link #remindAt} tính sẵn từ hạn; gửi đúng một lần ({@link #sentAt}). */
@Entity
@Table(name = "kpi_task_reminders")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 10)
    private KpiTaskReminderKind kind;

    @Column(name = "offset_minutes")
    private Integer offsetMinutes;

    @Column(name = "custom_at")
    private Instant customAt;

    @Column(name = "remind_at")
    private Instant remindAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
