package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Bộ tiêu chí chấm của tổ chức, theo hướng "máy bóc, người xác nhận" (tài liệu phân tích mục 9.3).
 *
 * <p>Vòng đời: {@code DRAFT} (AI vừa bóc, người đang đối chiếu) → {@code CONFIRMED} = ĐANG ÁP DỤNG cho
 * {@code orgUnitId} (mỗi đơn vị một bộ; {@code confirmedBy} là người áp, quyết định ai thay được) →
 * {@code ARCHIVED} = NGỪNG ÁP DỤNG (tự ngừng hoặc bị tài liệu khác thay), áp lại được cho đơn vị khác.
 * Lượt chấm ghi lại {@code version} đã dùng nên sửa bộ tiêu chí không làm đổi hồ sơ cũ.
 */
@Entity
@Table(name = "ai_criteria_sets")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiCriteriaSet {

    public static final String DRAFT = "DRAFT";
    public static final String CONFIRMED = "CONFIRMED";
    public static final String ARCHIVED = "ARCHIVED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    /** {@code null} = áp cho cả tổ chức. */
    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "version")
    private Integer version;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = DRAFT;

    @Column(name = "source_file_name")
    private String sourceFileName;

    /** Chữ gốc đã bóc từ tài liệu — giữ để màn đối chiếu hiện và để khi chấm còn trích được. */
    @Column(name = "source_text", columnDefinition = "TEXT")
    private String sourceText;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "confirmed_by")
    private UUID confirmedBy;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    /** Các mục tài liệu không bóc ra dòng nào, mỗi dòng một mục; dòng bắt đầu "!" là mục AI lỗi. */
    @Column(name = "skipped_sections", columnDefinition = "TEXT")
    private String skippedSections;

    /** Tài liệu đã nạp vào kho tri thức khi xác nhận (để gỡ khi có phiên bản mới / xoá bộ). */
    @Column(name = "rag_document_id")
    private UUID ragDocumentId;

    /** Loại tài liệu ({@code DocumentKind}) đã dùng để bóc — quyết định bộ nhóm và cách cắt khi nạp kho. */
    @Column(name = "profile", length = 40)
    private String profile;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;
}
