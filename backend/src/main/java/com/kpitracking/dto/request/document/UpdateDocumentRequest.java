package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Sửa tài liệu. Trường {@code null} = giữ nguyên. Đổi phạm vi: gửi {@code scope} (+ {@code orgUnitId} khi
 * chuyển sang UNIT); quy tắc đổi phạm vi ở docs/DOCUMENTS_DESIGN.md §5.3.
 */
@Data
public class UpdateDocumentRequest {
    @Size(max = 255)
    private String title;
    @Size(max = 4000)
    private String description;
    private DocumentCategory category;
    private Boolean aiEnabled;
    private DocumentScope scope;
    private UUID orgUnitId;
}
