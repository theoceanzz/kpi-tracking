package com.kpitracking.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.kpitracking.exception.FileStorageUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Supplier;

/**
 * Cổng DUY NHẤT tới Cloudinary. Không chỗ nào khác được giữ bean {@link Cloudinary} — mọi lệnh gửi /
 * xoá đi qua đây để cùng có timeout, cùng thử lại, cùng một loại lỗi
 * ({@link FileStorageUnavailableException} → 503 {@code FILE_STORAGE_UNAVAILABLE}).
 *
 * <p>Chỗ nào vừa đẩy tệp vừa ghi DB thì dùng {@link #uploadThenSave}: tệp đi lên NGOÀI transaction.
 */
@Service
@Slf4j
public class CloudinaryStorageService {

    private final Cloudinary cloudinary;
    private final TransactionTemplate tx;

    /*
     * SDK (cloudinary-http45) KHÔNG đặt timeout nào nếu không truyền: một kết nối tới Cloudinary bị
     * treo giữa chừng là luồng request chờ vô hạn, người dùng thấy thanh tải đứng mãi. Đây là gốc
     * của "upload lúc được lúc không" trên prod. Đơn vị: mili-giây, đúng như SDK đọc.
     */
    @Value("${cloudinary.connect-timeout-ms:10000}")
    private int connectTimeoutMs = 10_000;

    /** Thời gian tối đa chờ giữa hai gói dữ liệu (không phải tổng thời gian) — tệp 10MB vẫn kịp. */
    @Value("${cloudinary.socket-timeout-ms:60000}")
    private int socketTimeoutMs = 60_000;

    /** Số lần gửi tối đa cho mỗi tệp khi lỗi là lỗi mạng (IOException); lỗi Cloudinary từ chối thì không thử lại. */
    @Value("${cloudinary.upload-attempts:3}")
    private int uploadAttempts = 3;

    public CloudinaryStorageService(Cloudinary cloudinary, PlatformTransactionManager txManager) {
        this.cloudinary = cloudinary;
        this.tx = new TransactionTemplate(txManager);
    }

    /** Một tệp đã nằm trên Cloudinary. {@code resourceType} là loại thật (image/video/raw) — cần cho lúc xoá. */
    public record StoredFile(MultipartFile source, String url, String publicId, String resourceType) {}

    // ── Gửi tệp ─────────────────────────────────────────────────────────────

    /**
     * Gửi một tệp người dùng chọn. Giữ đuôi tệp trong public_id để URL tệp raw (Office) kết thúc
     * đúng .docx/.xlsx. Trả về map {@code url}, {@code public_id}, {@code resource_type}.
     */
    public Map<String, String> uploadFile(MultipartFile file, String folder) throws IOException {
        StoredFile stored = store(file, folder);
        return Map.of(
                "url", stored.url(),
                "public_id", stored.publicId(),
                "resource_type", stored.resourceType()
        );
    }

    /** Như {@link #uploadFile} nhưng trả record. */
    public StoredFile store(MultipartFile file, String folder) throws IOException {
        String originalName = file.getOriginalFilename();
        Map<String, Object> result = upload(file.getBytes(), options(
                "public_id", UUID.randomUUID() + extensionOf(originalName),
                "folder", folder,
                "resource_type", "auto"
        ), originalName);
        // Cloudinary tự chọn image/video/raw khi upload "auto", nhưng destroy KHÔNG nhận "auto":
        // trả về loại thật để lúc xoá gọi đúng.
        String resourceType = String.valueOf(result.getOrDefault("resource_type", "raw"));
        log.info("Cloudinary upload xong: folder={} size={}B type={}", folder, file.getSize(), resourceType);
        return new StoredFile(file, (String) result.get("secure_url"), (String) result.get("public_id"), resourceType);
    }

    /**
     * Tải một mảng byte lên (ảnh bóc từ tài liệu RAG). Cùng luật đặt public_id với
     * {@link #uploadFile}: giữ phần mở rộng để URL sinh ra kết thúc đúng đuôi tệp.
     */
    public Map<String, String> uploadBytes(byte[] bytes, String fileName, String folder) throws IOException {
        Map<String, Object> result = upload(bytes, options(
                "public_id", UUID.randomUUID() + extensionOf(fileName),
                "folder", folder,
                "resource_type", "image"
        ), fileName);
        return Map.of(
                "url", (String) result.get("secure_url"),
                "public_id", (String) result.get("public_id")
        );
    }

    /**
     * Lệnh gửi thô cho chỗ cần tuỳ chọn riêng (kho tài liệu: {@code type=authenticated}). Có timeout
     * và thử lại khi lỗi MẠNG (timeout, rớt kết nối, kết nối cũ trong pool bị đóng ngầm — loại lỗi
     * chập chờn hay gặp nhất). public_id cố định giữa các lần thử nên lần sau ghi đè đúng chỗ, không
     * đẻ bản sao nếu lần trước thực ra đã tới nơi. Lỗi Cloudinary từ chối hẳn (RuntimeException: sai
     * định dạng, hết hạn mức…) thì không thử lại.
     *
     * @throws FileStorageUnavailableException khi hết lượt thử hoặc Cloudinary từ chối
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> upload(byte[] bytes, Map<String, Object> options, String name)
            throws FileStorageUnavailableException {
        Map<String, Object> opts = withTimeouts(options);
        int attempts = Math.max(1, uploadAttempts);
        for (int attempt = 1; ; attempt++) {
            try {
                return cloudinary.uploader().upload(bytes, opts);
            } catch (IOException e) {
                log.warn("Cloudinary upload {} lỗi mạng lần {}/{}: {}", name, attempt, attempts, e.toString());
                if (attempt >= attempts) throw new FileStorageUnavailableException(name, e);
                try {
                    Thread.sleep(500L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new FileStorageUnavailableException(name, e);
                }
            } catch (RuntimeException e) {
                log.error("Cloudinary từ chối {}: {}", name, e.getMessage());
                throw new FileStorageUnavailableException(name, e);
            }
        }
    }

    // ── Gửi tệp rồi ghi DB ──────────────────────────────────────────────────

    /**
     * Khuôn dùng chung cho mọi chỗ "đẩy tệp lên rồi lưu bản ghi":
     * <ol>
     *   <li>{@code check} trong transaction ngắn — quyền, trạng thái, số tệp. Hỏng thì chưa có gì trên Cloudinary.</li>
     *   <li>Đẩy từng tệp lên Cloudinary, KHÔNG transaction.</li>
     *   <li>Transaction ngắn: chạy lại {@code check} (kỳ có thể vừa bị khoá, bản ghi vừa đổi trong lúc
     *       tải) rồi {@code save} với kết quả của nó.</li>
     * </ol>
     * Chặng 2 hoặc 3 hỏng thì xoá những tệp đã lên của lần này, không để rác.
     *
     * <p>Lý do: bọc cả việc gửi tệp trong một transaction là ôm một kết nối Hikari (và khoá FOR SHARE
     * của {@code CycleStatusGuard}) suốt lúc chờ Cloudinary — có khi cả phút. Vài người tải cùng lúc là
     * cạn pool, request khác chờ 30s rồi hỏng. Vì thế người gọi KHÔNG được tự {@code @Transactional}
     * (nếu có, các bước sẽ nhập vào transaction ngoài và lợi ích mất sạch).
     *
     * @param files có thể rỗng — khi đó chỉ chạy một transaction {@code check} + {@code save}
     */
    public <C, T> T uploadThenSave(MultipartFile[] files, String folder,
                                   Supplier<C> check, BiFunction<C, List<StoredFile>, T> save) throws IOException {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            log.warn("uploadThenSave được gọi bên trong transaction — tệp sẽ đi lên trong lúc giữ kết nối DB");
        }
        MultipartFile[] all = files == null ? new MultipartFile[0] : files;
        if (all.length == 0) {
            return tx.execute(status -> save.apply(check.get(), List.of()));
        }

        tx.executeWithoutResult(status -> check.get());

        List<StoredFile> stored = new ArrayList<>();
        try {
            for (MultipartFile file : all) stored.add(store(file, folder));
            return tx.execute(status -> save.apply(check.get(), List.copyOf(stored)));
        } catch (IOException | RuntimeException e) {
            stored.forEach(this::delete);
            throw e;
        }
    }

    // ── Xoá / đọc ───────────────────────────────────────────────────────────

    /** Xoá tệp vừa tải (biết chắc loại). Không ném lỗi — chỉ ghi log. */
    public void delete(StoredFile file) {
        deleteFile(file.publicId(), List.of(file.resourceType()));
    }

    /**
     * Xoá tệp trên Cloudinary. {@code destroy} không nhận {@code resource_type=auto} (chỉ nhận
     * image / video / raw) — bản cũ gửi "auto" nên MỌI lượt xoá đều hỏng, tệp nằm lại Cloudinary
     * mãi dù DB đã xoá. Loại tệp suy từ content-type; không rõ thì thử lần lượt cả ba loại.
     */
    public void deleteFile(String publicId, String contentType) {
        deleteFile(publicId, List.of(resourceTypeFor(contentType)));
    }

    private void deleteFile(String publicId, List<String> preferred) {
        List<String> order = new ArrayList<>(preferred);
        for (String t : List.of("image", "raw", "video")) if (!order.contains(t)) order.add(t);
        for (String type : order) {
            try {
                Map<String, Object> res = destroy(publicId, options("resource_type", type));
                if ("ok".equals(res.get("result"))) {
                    log.info("Đã xoá tệp Cloudinary: {} ({})", publicId, type);
                    return;
                }
            } catch (Exception e) {
                log.warn("Xoá tệp Cloudinary {} với resource_type={} lỗi: {}", publicId, type, e.getMessage());
            }
        }
        log.error("Không xoá được tệp khỏi Cloudinary: {}", publicId);
    }

    /** Lệnh xoá thô (có timeout) cho chỗ cần tuỳ chọn riêng. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> destroy(String publicId, Map<String, Object> options) throws IOException {
        try {
            return cloudinary.uploader().destroy(publicId, withTimeouts(options));
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Cloudinary destroy failed: " + e.getMessage(), e);
        }
    }

    /** Link tải có chữ ký cho tệp riêng tư (chỉ tạo URL, không gọi mạng). */
    public String privateDownloadUrl(String publicId, Map<String, Object> options) throws IOException {
        try {
            return cloudinary.privateDownload(publicId, "", options);
        } catch (Exception e) {
            throw new IOException("Cloudinary privateDownload failed: " + e.getMessage(), e);
        }
    }

    // ── Tiện ích ────────────────────────────────────────────────────────────

    /** {@code ObjectUtils.asMap} nhưng chắc chắn sửa được (để gắn timeout). */
    public static Map<String, Object> options(Object... keyValues) {
        return new HashMap<>(ObjectUtils.asMap(keyValues));
    }

    private Map<String, Object> withTimeouts(Map<String, Object> options) {
        Map<String, Object> opts = new HashMap<>(options);
        opts.put("connect_timeout", connectTimeoutMs);
        opts.put("connection_request_timeout", connectTimeoutMs);
        opts.put("timeout", socketTimeoutMs);
        return opts;
    }

    private static String extensionOf(String fileName) {
        if (fileName == null) return "";
        int dot = fileName.lastIndexOf('.');
        return dot == -1 ? "" : fileName.substring(dot);
    }

    private static String resourceTypeFor(String contentType) {
        if (contentType == null) return "raw";
        String t = contentType.toLowerCase();
        if (t.startsWith("image/")) return "image";
        if (t.startsWith("video/") || t.startsWith("audio/")) return "video";
        return "raw";
    }
}
