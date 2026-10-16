package com.kpitracking.dto.response.document;

import java.time.Instant;

/**
 * Tài liệu mở qua link công khai (người nhận không có tài khoản). Chỉ những gì cần để xem / tải — không lộ phạm vi,
 * đơn vị, thư mục hay người tạo trong tổ chức.
 *
 * @param format {@code blocks} / {@code sheet} / {@code markdown} / {@code text} khi xem trực tiếp được nội dung,
 *               ngược lại {@code null} (chỉ tải về / xem PDF)
 */
public record PublicDocumentResponse(String title, String fileName, String contentType, long fileSize, String format,
                                     String senderName, String organizationName, Instant updatedAt, Instant expiresAt) {}
