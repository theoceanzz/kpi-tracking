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
     * Upload a file to Cloudinary.
     *
     * @param file   the multipart file to upload
     * @param folder the folder path in Cloudinary (e.g. "submissions/{id}")
     * @return the secure URL of the uploaded file
     */
    public String uploadFile(MultipartFile file, String folder) throws IOException {
        try {
            // Simplified publicId to just UUID since we are specifying the 'folder' separately
            String publicId = UUID.randomUUID().toString();

            @SuppressWarnings("unchecked")
            Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(),
                    ObjectUtils.asMap(
                            "public_id", publicId,
                            "folder", folder,
                            "resource_type", "auto"
                    ));

            String secureUrl = (String) uploadResult.get("secure_url");
            log.info("File uploaded to Cloudinary successfully: {}", secureUrl);
            return secureUrl;
        } catch (Exception e) {
            log.error("Cloudinary upload failed for file {}: {}", file.getOriginalFilename(), e.getMessage());
            // Throwing a more descriptive exception if it's a Cloudinary specific error
            throw new IOException("Tải tập tin lên Cloudinary thất bại: " + e.getMessage(), e);
        }
    }

    /**
     * Generate a storage key (public_id) for a file.
     */
    public String getStorageKey(MultipartFile file, String folder) {
        return folder + "/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
    }

    /**
     * Delete a file from Cloudinary by its public_id (storageKey).
     */
    public void deleteFile(String storageKey) {
        try {
            cloudinary.uploader().destroy(storageKey, ObjectUtils.emptyMap());
            log.info("File deleted from Cloudinary: {}", storageKey);
        } catch (Exception e) {
            log.error("Xóa tập tin khỏi Cloudinary thất bại: {}", storageKey, e);
        }
    }

    /**
     * Get the URL for a file by its public_id.
     */
    public String getFileUrl(String storageKey) {
        return cloudinary.url().generate(storageKey);
    }
}
