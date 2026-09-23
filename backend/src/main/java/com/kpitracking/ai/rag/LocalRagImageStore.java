package com.kpitracking.ai.rag;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

/**
 * Cất ảnh trên đĩa của máy chủ, phục vụ qua {@code GET /api/v1/ai/rag/assets/{sha}.{ext}}.
 *
 * <p>Tên tệp là băm SHA-256 của nội dung: nạp lại cùng tài liệu ghi đè đúng tệp đó, và endpoint
 * phục vụ chỉ cần kiểm tên khớp mẫu {@code [0-9a-f]{64}.ext} là chặn được mọi kiểu đi ngược thư mục.
 *
 * <p>Ảnh được phục vụ qua endpoint CÓ xác thực (cookie {@code kg_at}) — thẻ {@code <img>} cùng gốc
 * tự gửi cookie nên client không phải làm gì thêm, mà ảnh chụp màn hình quy chế của tổ chức không
 * bị lộ cho người ngoài.
 */
@Component
@ConditionalOnProperty(name = "app.ai.rag.image-store", havingValue = "local", matchIfMissing = true)
@Slf4j
public class LocalRagImageStore implements RagImageStore {

    static final Set<String> ALLOWED_EXT = Set.of("png", "jpg", "jpeg", "gif", "webp");

    private final Path dir;

    public LocalRagImageStore(@Value("${app.ai.rag.assets-dir:data/rag-assets}") String dir) throws IOException {
        this.dir = Path.of(dir);
        Files.createDirectories(this.dir);
        log.info("Kho ảnh RAG cục bộ: {}", this.dir.toAbsolutePath());
    }

    @Override
    public String store(byte[] bytes, String fileName, String sha256) throws IOException {
        String ext = extensionOf(fileName);
        Path target = dir.resolve(sha256 + "." + ext);
        Files.write(target, bytes);
        return "/api/v1/ai/rag/assets/" + sha256 + "." + ext;
    }

    /** Đọc tệp đã cất; {@code null} nếu tên không hợp lệ hoặc không có. */
    public Path resolve(String name) {
        if (name == null || !name.matches("^[0-9a-f]{64}[.][a-z]{3,4}$")) return null;
        String ext = name.substring(name.lastIndexOf('.') + 1);
        if (!ALLOWED_EXT.contains(ext)) return null;
        Path p = dir.resolve(name);
        return Files.exists(p) ? p : null;
    }

    static String extensionOf(String fileName) {
        String ext = "png";
        if (fileName != null && fileName.lastIndexOf('.') != -1) {
            ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        }
        if (ext.equals("jpeg")) ext = "jpg";
        return ALLOWED_EXT.contains(ext) ? ext : "png";
    }
}
