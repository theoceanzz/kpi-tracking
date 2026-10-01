package com.kpitracking.service.document;

import com.kpitracking.enums.StorageProvider;

import java.io.IOException;

/**
 * Kho tệp gốc của tài liệu — RIÊNG TƯ (docs/DOCUMENTS_DESIGN.md §5.4). Không có URL công khai: mọi lượt
 * đọc đi qua backend sau khi đã kiểm quyền. Khác {@code CloudinaryStorageService} (minh chứng KPI), vốn tải
 * lên kiểu {@code upload} tức ai có link cũng mở được.
 *
 * <p>Bản cài đặt chọn bằng {@code app.documents.storage} ({@code local} | {@code cloudinary}).
 */
public interface DocumentStorage {

    StorageProvider provider();

    /**
     * @param folder thư mục logic, vd {@code documents/<orgId>}
     * @return khoá để đọc/xoá về sau — chỉ backend dùng, không bao giờ trả cho client
     */
    String store(byte[] bytes, String fileName, String folder) throws IOException;

    byte[] read(String key) throws IOException;

    /** Xoá; không có tệp thì coi như xong (dọn dẹp chạy lại không lỗi). */
    void delete(String key) throws IOException;

    /** Đuôi tệp (có dấu chấm) lấy từ tên, đã hạ chữ thường; không có đuôi thì chuỗi rỗng. */
    static String extensionOf(String fileName) {
        if (fileName == null) return "";
        int dot = fileName.lastIndexOf('.');
        return dot < 0 || dot == fileName.length() - 1 ? "" : fileName.substring(dot).toLowerCase(java.util.Locale.ROOT);
    }
}
