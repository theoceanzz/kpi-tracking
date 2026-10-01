package com.kpitracking.event;

import java.util.UUID;

/**
 * Sự kiện của luồng AI đọc bài nộp.
 *
 * <p><b>Chỉ mang ID và chuỗi, không mang entity</b> — listener chạy {@code @Async} ở luồng khác, entity
 * truyền qua sẽ rời session (cùng lý do ghi ở {@link BscEvents}).
 */
public final class AiReviewEvents {

    private AiReviewEvents() {}

    /**
     * Quản lý vừa nhờ AI đọc bài nộp; dòng {@code QUEUED} đã ghi.
     *
     * @param requesterEmail người bấm — luồng nền không có SecurityContext, mà sổ token cần biết ai dùng
     */
    public record Requested(UUID reviewId, String requesterEmail) {}
}
