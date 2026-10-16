package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Nhóm riêng của một người trong "Việc của tôi" (như "My tasks" của Lark): chỉ người đó thấy và dùng. */
@Entity
@Table(name = "task_my_sections")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskMySection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private double sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
