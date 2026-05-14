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

            log.info("File uploaded to Cloudinary successfully: {}", secureUrl);
            return Map.of(
                    "url", secureUrl,
                    "public_id", fullPublicId
            );
        } catch (Exception e) {
            log.error("Cloudinary upload failed for file {}: {}", file.getOriginalFilename(), e.getMessage());
            throw new IOException("Tải tập tin lên Cloudinary thất bại: " + e.getMessage(), e);
        }
    }

    /**
     * Delete a file from Cloudinary by its public_id.
     */
    public void deleteFile(String publicId) {
        try {
            // Need to specify resource_type: auto or raw for non-images
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "auto"));
            log.info("File deleted from Cloudinary: {}", publicId);
        } catch (Exception e) {
            log.error("Xóa tập tin khỏi Cloudinary thất bại: {}", publicId, e);
        }
    }

    /**
     * Get the URL for a file by its public_id.
     */
    public String getFileUrl(String publicId) {
        return cloudinary.url().generate(publicId);
    }
}
