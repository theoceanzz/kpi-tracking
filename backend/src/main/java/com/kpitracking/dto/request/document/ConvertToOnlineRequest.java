package com.kpitracking.dto.request.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Chuyển tại chỗ một tệp .docx / .md thành tài liệu soạn trực tuyến. {@code content} là mảng khối JSON đã chuyển ở
 * trình duyệt; {@code baseHash} là {@code contentHash} của tệp đã đọc để chuyển — tệp đổi giữa chừng thì báo xung đột.
 */
public record ConvertToOnlineRequest(@NotNull String content, @NotBlank String baseHash) {}
