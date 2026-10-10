package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Người theo dõi một công việc: xem, bình luận, nhận thông báo; không sửa. */
@Entity
@Table(name = "kpi_task_followers")
@IdClass(KpiTaskFollower.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskFollower {

    @Id
    @Column(name = "task_id")
    private UUID taskId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant addedAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID taskId;
        private UUID userId;
    }
}
