package com.kpitracking.entity.task;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

/** Việc nằm trong nhóm riêng nào của một người (mỗi người mỗi việc tối đa một nhóm). */
@Entity
@Table(name = "task_my_section_items")
@IdClass(TaskMySectionItem.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskMySectionItem {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "section_id", nullable = false)
    private UUID sectionId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID userId;
        private UUID taskId;
    }
}
