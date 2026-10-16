package com.kpitracking.event;

import java.util.List;
import java.util.UUID;

/** Sự kiện của công việc. Chỉ mang id — listener chạy sau commit và tự nạp lại. */
public final class TaskEvents {

    private TaskEvents() {}

    /** KPI cũ đã được thay — báo người còn việc chưa xong ở KPI cũ để họ chọn chuyển sang KPI mới. */
    public record KpiReplaced(UUID oldKpiId, UUID newKpiId) {}

    /**
     * Một người bị gỡ khỏi người theo dõi của các việc {@code taskIds} (việc cha và / hoặc việc con) vì việc chuyển sang
     * KPI người đó không xem được. Gộp theo người để mỗi lần đổi KPI chỉ báo họ một lần.
     */
    public record FollowersRevoked(UUID actorId, UUID userId, List<UUID> taskIds) {}

    /** Người được giao từ chối việc (việc không KPI) — báo người giao, kèm lý do. */
    public record Declined(UUID taskId, UUID declinedBy, UUID notifyUserId, String reason) {}

    /** Loại thay đổi: quyết định có báo ai không; mọi loại đều đẩy WebSocket để màn hình tự làm mới. */
    public enum Kind {
        CREATED, UPDATED, DUE_CHANGED, STATUS_CHANGED, COMPLETED, ASSIGNED, FOLLOWER_ADDED, FOLLOWER_REMOVED,
        SUBTASKS_CHANGED, CHECKLIST_CHANGED, ATTACHMENTS_CHANGED, REMINDERS_CHANGED, DELETED,
        // V42
        LISTS_CHANGED, SECTION_CHANGED, FIELD_CHANGED, TAGS_CHANGED, DEPENDENCIES_CHANGED, KPI_CHANGED
    }

    /**
     * Một công việc vừa đổi.
     *
     * @param previousOwnerId người phụ trách cũ (khi giao lại) — vẫn được báo và nhận gói làm mới danh sách
     * @param subjectUserId   người được thêm / bớt theo dõi; với ASSIGNED: người VỪA được giao (null = người chính)
     */
    public record Changed(UUID taskId, UUID actorId, Kind kind, UUID previousOwnerId, UUID subjectUserId) {

        public static Changed of(UUID taskId, UUID actorId, Kind kind) {
            return new Changed(taskId, actorId, kind, null, null);
        }
    }
}
