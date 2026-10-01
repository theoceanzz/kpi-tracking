package com.kpitracking.dto.response.document;

import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Tài liệu như người xem thấy. Không bao giờ có khoá lưu trữ hay link tệp: tải về đi qua
 * {@code GET /api/v1/documents/{id}/download}. {@code canEdit} do backend tính để frontend khỏi đoán quyền.
 */
@Data
@NoArgsConstructor
public class DocumentResponse {
    private UUID id;
    private DocumentScope scope;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID ownerId;
    private String title;
    private String description;
    private DocumentCategory category;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private Integer version;
    private Boolean aiEnabled;
    private DocumentAiStatus aiStatus;
    private Integer aiChunkCount;
    /** Lý do nạp hỏng, đã dịch theo ngôn ngữ người xem. */
    private String aiError;
    private Instant aiIndexedAt;
    private UUID createdBy;
    private String createdByName;
    private Instant createdAt;
    private Instant updatedAt;

    private boolean canEdit;
    /** Tài liệu của một đơn vị CHA của đơn vị đang lọc — hiện "Kế thừa từ …", chỉ đọc với người xem đó. */
    private boolean inherited;
    /** Đơn vị của tài liệu đã bị xoá; chỉ người quản lý tài liệu công ty thấy, để chuyển đi hoặc xoá. */
    private boolean orphan;
    /** Tài liệu tri thức cũ (rag_documents) không có tệp gốc: dùng cho AI, xoá được, không sửa/tải về được. */
    private boolean legacy;
}
