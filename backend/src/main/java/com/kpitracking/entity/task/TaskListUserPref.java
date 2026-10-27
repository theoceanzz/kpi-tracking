package com.kpitracking.entity.task;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Tuỳ chọn RIÊNG của một người với một danh sách ở cột trái: ghim lên đầu, xếp vào thư mục. Không ảnh hưởng người khác. */
@Entity
@Table(name = "task_list_user_prefs")
@IdClass(TaskListUserPref.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListUserPref {

    @Id
    @Column(name = "list_id")
    private UUID listId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "pinned", nullable = false)
    private boolean pinned;

    @Column(name = "folder", length = 100)
    private String folder;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID listId;
        private UUID userId;
    }
}
