package com.kpitracking.dto.request.task;

import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskVisibility;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import com.kpitracking.entity.TaskRecurrence;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Sửa công việc. {@code version} là bản client đang sửa — lệch với DB ⇒ 409 TASK_VERSION_CONFLICT (chống sửa đè).
 * {@code clearDueDate = true} để xoá hạn (vì {@code dueDate = null} nghĩa là "không đổi"); tương tự các cờ {@code clear*}.
 * Gửi từng trường một (tự lưu) là bình thường.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateKpiTaskRequest {

    @NotNull
    private Long version;
    private String title;
    private String description;
    private LocalDate dueDate;
    private boolean clearDueDate;
    private KpiTaskPriority priority;
    private KpiTaskVisibility visibility;
    private LocalTime dueTime;
    private boolean clearDueTime;
    private String descriptionDoc;
    /** Đặt / đổi quy tắc lặp. */
    private TaskRecurrence recurrence;
    private boolean clearRecurrence;
    private LocalDate recurrenceEndDate;
    private boolean clearRecurrenceEndDate;
    /** Việc lặp: THIS = chỉ lần này; FOLLOWING = lần này và các lần sau (mặc định THIS). */
    private String scope;
}
