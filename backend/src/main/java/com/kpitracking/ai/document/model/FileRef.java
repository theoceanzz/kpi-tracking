package com.kpitracking.ai.document.model;

import java.util.Locale;

/**
 * Một tệp cần đọc: tên (để lấy đuôi) + nội dung. Tệp nằm ở kho ngoài (Cloudinary) thì tải về trước bằng
 * {@code DocumentFetcher} rồi mới dựng {@code FileRef}.
 */
public record FileRef(String name, byte[] bytes) {

    public static FileRef of(String name, byte[] bytes) {
        return new FileRef(name == null || name.isBlank() ? "tai-lieu" : name, bytes == null ? new byte[0] : bytes);
    }

    /** Đuôi tệp, chữ thường, không dấu chấm ("docx"); rỗng khi không có. */
    public String extension() {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT).strip();
    }
}
