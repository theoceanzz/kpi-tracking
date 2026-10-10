package com.kpitracking.service.document;

import com.kpitracking.enums.StorageProvider;
import com.kpitracking.service.CloudinaryStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Tệp gốc trên Cloudinary ở chế độ {@code authenticated}: không URL công khai nào mở được. Đọc bằng link
 * tải có chữ ký hạn 5 phút ({@code privateDownload}) — và chính BACKEND mở link đó rồi trả luồng cho người
 * dùng, nên link ký cũng không bao giờ ra tới trình duyệt.
 *
 * <p>{@code resource_type = raw} cho mọi tệp: PDF/DOCX không phải ảnh, và {@code destroy} không nhận "auto".
 *
 * <p>Gửi / xoá đi qua {@link CloudinaryStorageService} (cổng duy nhất tới Cloudinary) để có cùng
 * timeout và thử lại như mọi chỗ tải tệp khác.
 */
@Component
@ConditionalOnProperty(name = "app.documents.storage", havingValue = "cloudinary")
@RequiredArgsConstructor
@Slf4j
public class CloudinaryDocumentStorage implements DocumentStorage {

    private static final String TYPE = "authenticated";
    private static final String RESOURCE_TYPE = "raw";
    private static final Duration LINK_TTL = Duration.ofMinutes(5);

    private final CloudinaryStorageService cloudinary;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    @Override
    public StorageProvider provider() {
        return StorageProvider.CLOUDINARY;
    }

    @Override
    public String store(byte[] bytes, String fileName, String folder) throws IOException {
        // Giữ đuôi trong public_id: với tệp raw, đuôi là một phần của khoá.
        String publicId = UUID.randomUUID() + DocumentStorage.extensionOf(fileName);
        Map<String, Object> res = cloudinary.upload(bytes, CloudinaryStorageService.options(
                "public_id", publicId,
                "folder", folder,
                "resource_type", RESOURCE_TYPE,
                "type", TYPE), fileName);
        return String.valueOf(res.get("public_id"));
    }

    @Override
    public byte[] read(String key) throws IOException {
        try {
            String url = cloudinary.privateDownloadUrl(key, CloudinaryStorageService.options(
                    "resource_type", RESOURCE_TYPE,
                    "type", TYPE,
                    "expires_at", Instant.now().plus(LINK_TTL).getEpochSecond()));
            HttpResponse<byte[]> res = http.send(
                    HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() / 100 != 2) {
                throw new IOException("Kho tài liệu trả " + res.statusCode());
            }
            return res.body();
        } catch (IOException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Bị ngắt khi đọc tài liệu", e);
        } catch (Exception e) {
            throw new IOException("Đọc tài liệu từ kho riêng tư thất bại: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String key) throws IOException {
        cloudinary.destroy(key, CloudinaryStorageService.options("resource_type", RESOURCE_TYPE, "type", TYPE));
    }
}
