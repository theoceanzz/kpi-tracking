package com.kpitracking.entity;

import com.kpitracking.enums.StorageProvider;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Tệp đính kèm một công việc. */
@Entity
@Table(name = "kpi_task_attachments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_url", nullable = false, columnDefinition = "TEXT")
    private String fileUrl;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_provider", nullable = false, length = 20)
    @Builder.Default
    private StorageProvider storageProvider = StorageProvider.CLOUDINARY;

    @Column(name = "storage_key", columnDefinition = "TEXT")
    private String storageKey;

    /** Tài liệu thư viện mà tệp này được sao từ đó (null = tải từ máy). Không khoá ngoại — xem V37 (phần 3). */
    @Column(name = "source_document_id")
    private UUID sourceDocumentId;

    /** Tên tài liệu gốc lúc đính kèm. */
    @Column(name = "source_document_title", length = 500)
    private String sourceDocumentTitle;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
