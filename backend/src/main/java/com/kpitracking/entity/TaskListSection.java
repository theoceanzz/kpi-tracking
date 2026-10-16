package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Nhóm (section) trong một danh sách công việc. Việc không thuộc nhóm nào nằm ở "Chưa phân nhóm". */
@Entity
@Table(name = "task_list_sections")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListSection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Double sortOrder = 0d;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
