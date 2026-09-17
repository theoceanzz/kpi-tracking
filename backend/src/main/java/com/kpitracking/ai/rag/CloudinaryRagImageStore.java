package com.kpitracking.ai.rag;

import com.kpitracking.service.CloudinaryStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Cất ảnh lên Cloudinary — cho bản SaaS đã có tài khoản. */
@Component
@ConditionalOnProperty(name = "app.ai.rag.image-store", havingValue = "cloudinary")
@RequiredArgsConstructor
public class CloudinaryRagImageStore implements RagImageStore {

    private final CloudinaryStorageService storage;

    @Override
    public String store(byte[] bytes, String fileName, String sha256) throws IOException {
        return storage.uploadBytes(bytes, fileName, "rag").get("url");
    }
}
