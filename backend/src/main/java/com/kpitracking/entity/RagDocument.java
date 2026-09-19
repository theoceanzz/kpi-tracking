package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Bản ghi quản trị của một tài liệu đã nạp vào kho tri thức RAG.
 *
 * <p>Nội dung đã cắt đoạn và vector KHÔNG nằm ở đây — chúng ở kho pgvector do langchain4j quản, nối
 * với bản ghi này qua {@code metadata.docId}. Xem V3__rag_documents.sql.
 */
@Entity
@Table(name = "rag_documents")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RagDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** {@code null} = tài liệu chung toàn hệ thống; có giá trị = quy chế riêng của một tổ chức. */
    @Column(name = "organization_id")
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 30)
    private Source source;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "file_name")
    private String fileName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "chunk_count", nullable = false)
    @Builder.Default
    private Integer chunkCount = 0;

    @Column(name = "image_count", nullable = false)
    @Builder.Default
    private Integer imageCount = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    /**
     * Loại tài liệu. {@link #GUIDE} là của nền tảng (không tổ chức); ba loại còn lại luôn thuộc MỘT
     * tổ chức. Nhánh HELP đọc tất cả loại của tổ chức; gợi ý KPI chỉ đọc {@link #JOB_DESCRIPTION}
     * và {@link #STRATEGY} — quy chế nói về cách chấm, không nói về việc phải làm.
     */
    public enum Source {
        /** Bộ hướng dẫn sử dụng KeyGo — chung toàn hệ thống. */
        GUIDE,
        /** Quy chế, quy định nội bộ của tổ chức. */
        REGULATION,
        /** Mô tả công việc, chức năng nhiệm vụ của đơn vị/chức vụ. */
        JOB_DESCRIPTION,
        /** Chiến lược, mục tiêu năm, bản đồ chiến lược (dạng văn bản). */
        STRATEGY;

        public boolean isOrganizationScoped() {
            return this != GUIDE;
        }
    }

    public enum Status { PENDING, READY, FAILED }
}
