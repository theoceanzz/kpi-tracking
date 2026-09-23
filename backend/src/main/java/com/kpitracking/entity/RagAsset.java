package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Ảnh bóc từ tài liệu RAG, đã tải lên Cloudinary; khoá theo băm nội dung để không tải trùng. */
@Entity
@Table(name = "rag_assets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RagAsset {

    @Id
    @Column(name = "content_sha256", length = 64)
    private String contentSha256;

    @Column(name = "url", nullable = false, columnDefinition = "TEXT")
    private String url;

    @Column(name = "public_id", nullable = false, columnDefinition = "TEXT")
    private String publicId;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
