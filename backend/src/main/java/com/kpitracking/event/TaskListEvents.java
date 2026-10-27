package com.kpitracking.event;

import com.kpitracking.enums.task.KpiTaskStatus;

import java.util.UUID;

/**
 * Sự kiện kích hoạt tự động hoá của danh sách công việc ({@code TaskAutomationRunner}, chạy sau commit). Chỉ mang id.
 * {@code actorId} của lượt do chính tự động hoá gây ra được đánh dấu để chặn vòng lặp.
 */
public final class TaskListEvents {

    private TaskListEvents() {}

    /** Việc (gốc) vừa được thêm vào danh sách. */
    public record ItemAdded(UUID listId, UUID taskId, UUID actorId) {}

    /** Việc vừa chuyển sang nhóm {@code sectionId} (null = Chưa phân nhóm) trong danh sách. */
    public record SectionChanged(UUID listId, UUID taskId, UUID sectionId, UUID actorId) {}

    /** Trạng thái của việc vừa đổi (mọi danh sách chứa việc gốc đều xét). */
    public record StatusChanged(UUID taskId, UUID actorId, KpiTaskStatus from, KpiTaskStatus to) {}

    /** Một trường tuỳ chỉnh vừa đổi giá trị. */
    public record FieldChanged(UUID listId, UUID taskId, UUID fieldId, UUID actorId) {}

    /** Một người vừa được thêm làm thành viên danh sách — báo người đó. */
    public record MemberAdded(UUID listId, UUID userId, UUID actorId) {}
}
