package com.kpitracking.dto.request.task;

import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskVisibility;
import lombok.*;

import com.kpitracking.entity.task.TaskRecurrence;
import com.kpitracking.entity.task.TaskSourceRef;
import com.kpitracking.enums.task.TaskCompletionMode;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tạo công việc. Chỉ tên là bắt buộc (TASK_TITLE_REQUIRED); KPI tuỳ chọn — có KPI thì luật KPI áp như cũ. */
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

    // ── V42 ──
    /** Người thực hiện (nhiều người); bỏ trống = {@code ownerId} hoặc chính người tạo. Người đầu tiên là người chính. */
    private List<UUID> assigneeIds;
    private TaskCompletionMode completionMode;
    private LocalDate startDate;
    private LocalTime startTime;
    /** Thêm ngay vào danh sách (và nhóm) này — cần quyền EDITOR trên danh sách. */
    private UUID listId;
    private UUID sectionId;
    private List<UUID> tagIds;
    /** Giá trị trường tuỳ chỉnh của {@code listId}: fieldId → giá trị. */
    private Map<UUID, Object> fieldValues;
    /** Tạo từ bình luận / tài liệu / K.AI. */
    private TaskSourceRef sourceRef;
}
