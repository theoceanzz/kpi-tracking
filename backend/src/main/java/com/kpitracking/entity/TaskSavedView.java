package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Chế độ xem đã lưu (chế độ, nhóm, sắp xếp, bộ lọc, cột) — JSON do giao diện định nghĩa, máy chủ chỉ giới hạn kích thước.
 * {@link #listId} null = trang "Của tôi"; {@link #shared} = mọi thành viên danh sách thấy.
 */
@Entity
@Table(name = "task_saved_views")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskSavedView {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "list_id")
    private UUID listId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config", columnDefinition = "jsonb", nullable = false)
    private String config;

    @Column(name = "shared", nullable = false)
    @Builder.Default
    private Boolean shared = false;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Double sortOrder = 0d;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
