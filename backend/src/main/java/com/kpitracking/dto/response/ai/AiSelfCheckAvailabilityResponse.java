package com.kpitracking.dto.response.ai;

/**
 * Người đang đăng nhập có tự soi bài được không, để giao diện ẩn hoặc khoá nút kèm lý do.
 *
 * @param reason          {@code null} khi dùng được; {@code AI_OFF} / {@code REVIEW_OFF} / {@code UNIT_OFF}: tổ chức
 *                        hoặc đơn vị chưa bật (giao diện ẩn hẳn); {@code NO_QUOTA}: chưa được cấp token;
 *                        {@code QUOTA_USED}: đã dùng hết token tháng này
 * @param remainingTokens số token còn dùng được tháng này
 */
public record AiSelfCheckAvailabilityResponse(boolean available, String reason, long remainingTokens) {}
