package com.kpitracking.entity.task;

import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.TaskCompletionMode;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.KpiTaskVisibility;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.user.User;
/**
 * Công việc kiểu Lark (V37, V42 — docs/TASKS_DESIGN.md). Chỉ để theo dõi — không đổi kết quả KPI.
 *
 * <p>{@link #kpiCriteriaId} TUỲ CHỌN và giữ dạng id thay vì quan hệ: KPI bị xoá mềm thì {@code KpiCriteria} có
 * {@code @SQLRestriction} sẽ không nạp được, còn task vẫn phải mở ra được (hiện "KPI đã xoá" + {@link #kpiNameSnapshot}).
 * Ba trạng thái (không KPI / KPI đã xoá / KPI còn) chỉ được đọc qua {@code TaskKpiLinks}.
 * {@link #owner} là người phụ trách CHÍNH; danh sách đầy đủ ở {@code kpi_task_assignees}.
 * {@link #version} chống sửa đè khi hai người / hai tab cùng sửa.
 */
@Entity
@Table(name = "kpi_tasks")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "kpi_criteria_id")
    private UUID kpiCriteriaId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** Giờ của hạn (giờ VN); null = hạn cả ngày. */
    @Column(name = "due_time")
    private LocalTime dueTime;

    /** Ngày / giờ bắt đầu (Gantt, lịch nhiều ngày). */
    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    /** Việc con — trỏ tới việc cha; cả cây dùng KPI của việc gốc. */
    @Column(name = "parent_task_id")
    private UUID parentTaskId;

    /** Việc gốc của cây; null = chính nó là gốc. */
    @Column(name = "root_task_id")
    private UUID rootTaskId;

    /** Id tổ tiên theo thứ tự gốc → cha (rỗng với việc gốc). */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "ancestor_ids", columnDefinition = "uuid[]", nullable = false)
    @Builder.Default
    private UUID[] ancestorIds = new UUID[0];

    /** 0 = gốc; tối đa {@code KpiTaskService.MAX_DEPTH}. */
    @Column(name = "depth", nullable = false)
    @Builder.Default
    private Short depth = 0;

    /** Lark "Mark as Milestone": việc mốc (hình thoi) — V42 §6. */
    @Column(name = "milestone", nullable = false)
    @Builder.Default
    private boolean milestone = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "completion_mode", nullable = false, length = 10)
    @Builder.Default
    private TaskCompletionMode completionMode = TaskCompletionMode.ANY;

    /** Nguồn tạo việc (bình luận / tài liệu / K.AI) — chỉ để hiện "Tạo từ …". */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_ref", columnDefinition = "jsonb")
    private TaskSourceRef sourceRef;

    /** Mô tả có định dạng: JSON của trình soạn tiptap (không phải HTML). {@link #description} là bản chữ thuần. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description_doc", columnDefinition = "jsonb")
    private String descriptionDoc;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recurrence_rule", columnDefinition = "jsonb")
    private TaskRecurrence recurrence;

    @Column(name = "recurrence_end_date")
    private LocalDate recurrenceEndDate;

    @Column(name = "series_id")
    private UUID seriesId;

    @Column(name = "series_index")
    private Integer seriesIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 10)
    @Builder.Default
    private KpiTaskPriority priority = KpiTaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private KpiTaskStatus status = KpiTaskStatus.TODO;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    @Builder.Default
    private KpiTaskVisibility visibility = KpiTaskVisibility.KPI_SCOPE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Double sortOrder = 0d;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "reminded_due_at")
    private Instant remindedDueAt;

    @Column(name = "reminded_overdue_at")
    private Instant remindedOverdueAt;

    /** Tên KPI chụp lại lúc KPI bị xoá. */
    @Column(name = "kpi_name_snapshot")
    private String kpiNameSnapshot;

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

    /** Id việc gốc của cây (chính nó nếu là gốc). */
    public UUID rootId() {
        return rootTaskId != null ? rootTaskId : id;
    }

    public boolean isRoot() {
        return parentTaskId == null;
    }
}
