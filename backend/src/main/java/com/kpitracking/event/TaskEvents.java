package com.kpitracking.event;

import java.util.UUID;

/** Sự kiện của công việc gắn KPI. Chỉ mang id — listener chạy sau commit và tự nạp lại. */
public final class TaskEvents {

    private TaskEvents() {}

    /** KPI cũ đã được thay — báo người còn việc chưa xong ở KPI cũ để họ chọn chuyển sang KPI mới. */
    public record KpiReplaced(UUID oldKpiId, UUID newKpiId) {}

    /** Loại thay đổi: quyết định có báo ai không; mọi loại đều đẩy WebSocket để màn hình tự làm mới. */
    public enum Kind {
        CREATED, UPDATED, DUE_CHANGED, STATUS_CHANGED, COMPLETED, ASSIGNED, FOLLOWER_ADDED, FOLLOWER_REMOVED,
        SUBTASKS_CHANGED, CHECKLIST_CHANGED, ATTACHMENTS_CHANGED, REMINDERS_CHANGED, DELETED
    }

    /**
     * Một công việc vừa đổi.
     *
     * @param previousOwnerId người phụ trách cũ (khi giao lại) — vẫn được báo và nhận gói làm mới danh sách
     * @param subjectUserId   người được thêm / bớt theo dõi
     */
    public record Changed(UUID taskId, UUID actorId, Kind kind, UUID previousOwnerId, UUID subjectUserId) {

        public static Changed of(UUID taskId, UUID actorId, Kind kind) {
            return new Changed(taskId, actorId, kind, null, null);
        }
    }
}
