package com.kpitracking.entity.task;

import com.kpitracking.enums.task.TaskFieldType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Trường tuỳ chỉnh của một danh sách. {@link #options} (JSON, chỉ SINGLE/MULTI_SELECT): mảng {id, label, color} — giữ
 * dạng chuỗi JSON, đọc / kiểm ở {@code TaskFieldCodec}.
 */
@Entity
@Table(name = "task_list_fields")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListField {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private TaskFieldType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options", columnDefinition = "jsonb")
    private String options;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Double sortOrder = 0d;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
