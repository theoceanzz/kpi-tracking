package com.kpitracking.dto.response.submission;

import com.kpitracking.enums.StorageProvider;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AttachmentResponse {

    private UUID id;
    private String fileName;
    private String fileUrl;
    private Long fileSize;
    private String contentType;
    private StorageProvider storageProvider;
    private Instant createdAt;
}
