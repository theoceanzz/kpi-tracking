package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

/** Nhãn gắn trên một việc. */
@Entity
@Table(name = "task_tag_links")
@IdClass(TaskTagLink.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskTagLink {

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Id
    @Column(name = "tag_id")
    private UUID tagId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID taskId;
        private UUID tagId;
    }
}
