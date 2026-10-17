package com.kpitracking.entity.task;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Giá trị một trường tuỳ chỉnh trên một việc, dạng JSON {"v": …} (xem {@code TaskFieldCodec}). */
@Entity
@Table(name = "task_field_values")
@IdClass(TaskFieldValue.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskFieldValue {

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Id
    @Column(name = "field_id")
    private UUID fieldId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "value", columnDefinition = "jsonb", nullable = false)
    private String value;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID taskId;
        private UUID fieldId;
    }
}
