package com.kpitracking.service.document;

import com.kpitracking.enums.StorageProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Lưu tệp gốc trên đĩa máy chủ — cho dev (máy không có Cloudinary riêng tư) và cài đặt một máy.
 * Không dùng cho prod chạy container mà không gắn volume: khởi động lại là mất tệp.
 */
@Component
@ConditionalOnProperty(name = "app.documents.storage", havingValue = "local", matchIfMissing = true)
@Slf4j
public class LocalDocumentStorage implements DocumentStorage {

    /** Khoá do chính lớp này sinh: {@code <thư mục>/<uuid><đuôi>}. Đọc/xoá chỉ nhận đúng dạng đó — chặn {@code ../}. */
    private static final Pattern SAFE_KEY = Pattern.compile("[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*/[0-9a-f-]{36}([.][a-z0-9]{1,8})?");

    private final Path root;

    public LocalDocumentStorage(@Value("${app.documents.storage-dir:data/documents}") String dir) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
    }

    @Override
    public StorageProvider provider() {
        return StorageProvider.LOCAL;
    }

    @Override
    public String store(byte[] bytes, String fileName, String folder) throws IOException {
        String key = folder + "/" + UUID.randomUUID() + DocumentStorage.extensionOf(fileName);
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.write(target, bytes);
        return key;
    }

    @Override
    public byte[] read(String key) throws IOException {
        return Files.readAllBytes(resolve(key));
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(resolve(key));
    }

    private Path resolve(String key) {
        if (key == null || !SAFE_KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("Khoá tệp không hợp lệ");
        }
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Khoá tệp không hợp lệ");
        return p;
    }
}
