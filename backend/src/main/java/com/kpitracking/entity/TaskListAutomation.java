package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/** Luật tự động hoá của một danh sách: khi {@link #trigger} thì {@link #action} (JSON — {@code TaskAutomationRule}). */
@Entity
@Table(name = "task_list_automations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListAutomation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger", columnDefinition = "jsonb", nullable = false)
    private String trigger;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action", columnDefinition = "jsonb", nullable = false)
    private String action;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "run_count", nullable = false)
    @Builder.Default
    private Integer runCount = 0;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
