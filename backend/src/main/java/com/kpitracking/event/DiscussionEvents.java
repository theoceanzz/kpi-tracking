package com.kpitracking.event;

import com.kpitracking.enums.DiscussionTargetType;

import java.util.List;
import java.util.UUID;

/**
 * Sự kiện của khung thảo luận. Chỉ mang id — listener chạy SAU COMMIT và tự nạp lại dữ liệu.
 */
public final class DiscussionEvents {

    private DiscussionEvents() {}

    public enum Action { CREATED, UPDATED, DELETED, REACTED }

    /** Có thay đổi trong khung thảo luận — đẩy qua WebSocket cho người đang mở. */
    public record Changed(DiscussionTargetType targetType, UUID targetId, UUID commentId, UUID parentId, Action action) {}

    /** Bình luận người dùng mới — báo người được nhắc tên, người được trả lời, người theo dõi đối tượng. */
    public record CommentCreated(UUID commentId, List<UUID> mentionIds) {}

    /** Sửa bình luận có thêm người được nhắc tên — chỉ báo những người MỚI được nhắc. */
    public record MentionsAdded(UUID commentId, List<UUID> mentionIds) {}
}
