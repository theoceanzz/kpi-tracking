package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

/** Danh sách công việc kiểu Lark (V42): gom việc theo dự án / nhóm, có thành viên, nhóm, trường tuỳ chỉnh. */
@Entity
@Table(name = "task_lists")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskList {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "color", length = 20)
    private String color;

    /** Biểu tượng (emoji) hiện cạnh tên ở cột trái. */
    @Column(name = "icon", length = 16)
    private String icon;

    /** Cấu hình bảng điều khiển (biểu đồ nào, thứ tự) — giao diện định nghĩa, máy chủ chỉ lưu. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "dashboard", columnDefinition = "jsonb")
    private String dashboard;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
