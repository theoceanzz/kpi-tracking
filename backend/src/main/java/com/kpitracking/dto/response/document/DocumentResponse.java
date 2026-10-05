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
    /** Băm nội dung tệp hiện hành — trình soạn trực tuyến gửi lại khi lưu để phát hiện lưu chen. */
    private String contentHash;
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

    /** Quản lý tài liệu: sửa thông tin, thay tệp, xoá, di chuyển, chia sẻ. */
    private boolean canEdit;
    /** Sửa NỘI DUNG trong trình soạn trực tuyến: người quản lý, hoặc được chia sẻ quyền chỉnh sửa. */
    private boolean canEditContent;
    /** Tài liệu của một đơn vị CHA của đơn vị đang lọc — hiện "Kế thừa từ …", chỉ đọc với người xem đó. */
    private boolean inherited;
    /** Đơn vị của tài liệu đã bị xoá; chỉ người quản lý tài liệu công ty thấy, để chuyển đi hoặc xoá. */
    private boolean orphan;
    /** Tài liệu tri thức cũ (rag_documents) không có tệp gốc: dùng cho AI, xoá được, không sửa/tải về được. */
    private boolean legacy;

    // ── Thư mục, trạng thái riêng của người xem, chia sẻ, thùng rác (kiểu Lark Docs) ──
    private UUID folderId;
    private String folderName;
    /** Người xem đánh dấu yêu thích. */
    private boolean favorite;
    /** Người xem ghim lên thanh bên. */
    private boolean pinned;
    /** Lần mở gần nhất của CHÍNH người xem (cột "Mở gần đây"). */
    private Instant lastOpenedAt;
    /** Xem được nhờ được chia sẻ (không nhờ phạm vi) — chỉ xem, không sửa. */
    private boolean sharedWithMe;
    /** Số lượt chia sẻ — chỉ điền cho người sửa được tài liệu. */
    private long shareCount;
    private Instant deletedAt;
    private String deletedByName;
    private java.time.LocalDate reviewDate;
    private java.time.LocalDate expiryDate;
    /** Đã tới / quá ngày rà soát. */
    private boolean reviewDue;
    /** Đã hết hiệu lực. */
    private boolean expired;
}
