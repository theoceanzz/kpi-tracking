package com.kpitracking.dto.request.task;

import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskVisibility;
import lombok.*;

import com.kpitracking.entity.TaskRecurrence;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Tạo công việc. KPI và tên là bắt buộc — service trả mã lỗi riêng (TASK_KPI_REQUIRED / TASK_TITLE_REQUIRED). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateKpiTaskRequest {

    private UUID kpiId;
    private String title;
    private String description;
    private LocalDate dueDate;
    private KpiTaskPriority priority;
    private KpiTaskVisibility visibility;
    /** Các bước checklist tạo sẵn cùng lúc (tuỳ chọn). */
    private List<String> checklist;
    /** Người phụ trách; bỏ trống = chính người tạo. */
    private UUID ownerId;
    /** Tạo thành việc con của task này (cùng KPI với task cha — {@code kpiId} bị bỏ qua). */
    private UUID parentTaskId;
    private LocalTime dueTime;
    /** Mô tả có định dạng (JSON tiptap); {@code description} là bản chữ thuần. */
    private String descriptionDoc;
    private List<UUID> followerIds;
    /** Bỏ trống ⇒ mặc định nhắc trước 1 ngày khi có hạn; danh sách rỗng ⇒ không nhắc. */
    private List<KpiTaskReminderInput> reminders;
    private TaskRecurrence recurrence;
    private LocalDate recurrenceEndDate;
}
