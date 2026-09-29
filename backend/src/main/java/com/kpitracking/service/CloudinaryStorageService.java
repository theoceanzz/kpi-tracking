package com.kpitracking.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CloudinaryStorageService {

    private final Cloudinary cloudinary;

    /**
     * Upload a file to Cloudinary and return information about the upload.
     * Includes extension in public_id for better support in Office viewers.
     *
     * @param file   the multipart file to upload
     * @param folder the folder path in Cloudinary (e.g. "submissions/{id}")
     * @return a Map containing "url" and "public_id"
     */
    public Map<String, String> uploadFile(MultipartFile file, String folder) throws IOException {
        try {
            String originalName = file.getOriginalFilename();
            String extension = "";
            if (originalName != null && originalName.lastIndexOf(".") != -1) {
                extension = originalName.substring(originalName.lastIndexOf("."));
            }

            // Important: Include extension in public_id for raw files (Office docs)
            // so the generated URL ends with .docx/.xlsx etc.
            String publicId = UUID.randomUUID().toString() + extension;

            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(),
                    ObjectUtils.asMap(
                            "public_id", publicId,
                            "folder", folder,
                            "resource_type", "auto"
                    ));

            String secureUrl = (String) uploadResult.get("secure_url");
            // The stored public_id includes the folder
            String fullPublicId = (String) uploadResult.get("public_id");
            // Cloudinary tự chọn image/video/raw khi upload "auto", nhưng destroy KHÔNG nhận "auto":
            // trả về loại thật để lúc xoá gọi đúng.
            String resourceType = String.valueOf(uploadResult.getOrDefault("resource_type", "raw"));

            log.info("Cloudinary upload xong: folder={} size={}B type={}", folder, file.getSize(), resourceType);
            return Map.of(
                    "url", secureUrl,
                    "public_id", fullPublicId,
                    "resource_type", resourceType
            );
        } catch (Exception e) {
            log.error("Cloudinary upload failed for file {}: {}", file.getOriginalFilename(), e.getMessage());
            throw new IOException("Tải tập tin lên Cloudinary thất bại: " + e.getMessage(), e);
        }
    }

    /**
     * Tải một mảng byte lên (ảnh bóc từ tài liệu RAG). Cùng luật đặt public_id với
     * {@link #uploadFile}: giữ phần mở rộng để URL sinh ra kết thúc đúng đuôi tệp.
     */
    public Map<String, String> uploadBytes(byte[] bytes, String fileName, String folder) throws IOException {
        try {
            String extension = "";
            if (fileName != null && fileName.lastIndexOf('.') != -1) {
                extension = fileName.substring(fileName.lastIndexOf('.'));
            }
            String publicId = UUID.randomUUID() + extension;

            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(bytes,
                    ObjectUtils.asMap(
                            "public_id", publicId,
                            "folder", folder,
                            "resource_type", "image"
                    ));
            return Map.of(
                    "url", (String) uploadResult.get("secure_url"),
                    "public_id", (String) uploadResult.get("public_id")
            );
        } catch (Exception e) {
            log.error("Cloudinary upload failed for {}: {}", fileName, e.getMessage());
            throw new IOException("Tải ảnh lên Cloudinary thất bại: " + e.getMessage(), e);
        }
    }

    /**
     * Xoá tệp trên Cloudinary. {@code destroy} không nhận {@code resource_type=auto} (chỉ nhận
     * image / video / raw) — bản cũ gửi "auto" nên MỌI lượt xoá đều hỏng, tệp nằm lại Cloudinary
     * mãi dù DB đã xoá. Loại tệp suy từ content-type; không rõ thì thử lần lượt cả ba loại.
     */
    public void deleteFile(String publicId, String contentType) {
        String guess = resourceTypeFor(contentType);
        java.util.List<String> order = new java.util.ArrayList<>(java.util.List.of(guess));
        for (String t : java.util.List.of("image", "raw", "video")) if (!order.contains(t)) order.add(t);
        for (String type : order) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> res = cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", type));
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

    /** Giữ chữ ký cũ cho các chỗ gọi chưa có content-type. */
    public void deleteFile(String publicId) {
        deleteFile(publicId, null);
    }

    private static String resourceTypeFor(String contentType) {
        if (contentType == null) return "raw";
        String t = contentType.toLowerCase();
        if (t.startsWith("image/")) return "image";
        if (t.startsWith("video/") || t.startsWith("audio/")) return "video";
        return "raw";
    }

    /**
     * Get the URL for a file by its public_id.
     */
    public String getFileUrl(String publicId) {
        return cloudinary.url().generate(publicId);
    }
}
