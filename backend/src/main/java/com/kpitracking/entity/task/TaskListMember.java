package com.kpitracking.entity.task;

import com.kpitracking.enums.task.TaskListRole;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Thành viên danh sách: MỘT người hoặc MỘT đơn vị (gồm cả đơn vị con). */
@Entity
@Table(name = "task_list_members")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskListMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 10)
    private TaskListRole role;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant addedAt = Instant.now();
}
