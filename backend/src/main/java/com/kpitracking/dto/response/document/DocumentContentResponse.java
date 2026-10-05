package com.kpitracking.dto.response.document;

/**
 * Nội dung chữ của một tài liệu soạn được trực tuyến.
 *
 * @param format      {@code markdown} hoặc {@code text}
 * @param contentHash băm của đúng nội dung này — gửi lại khi lưu để phát hiện người khác lưu chen
 */
public record DocumentContentResponse(String content, String format, String contentHash, Integer version) {}
