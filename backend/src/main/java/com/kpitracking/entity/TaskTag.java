package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Nhãn công việc dùng chung trong tổ chức. */
@Entity
@Table(name = "task_tags")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskTag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
