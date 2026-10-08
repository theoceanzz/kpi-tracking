package com.kpitracking.entity;

import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.enums.KpiTaskVisibility;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Công việc cá nhân gắn với một KPI (V37__kpi_discussion_tasks.sql). Chỉ để theo dõi — không đổi kết quả KPI.
 *
 * <p>{@link #kpiCriteriaId} giữ dạng id thay vì quan hệ: KPI bị xoá mềm thì {@code KpiCriteria} có
 * {@code @SQLRestriction} sẽ không nạp được, còn task vẫn phải mở ra được (hiện "KPI đã xoá" + {@link #kpiNameSnapshot}).
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

    @Column(name = "kpi_criteria_id", nullable = false)
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

    /** Việc con (1 cấp) — trỏ tới task cha, cùng KPI. */
    @Column(name = "parent_task_id")
    private UUID parentTaskId;

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
}
