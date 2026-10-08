package com.kpitracking.dto.response.document;

import java.util.List;

/**
 * Nội dung một cấp thư mục: thư mục đang mở ({@code null} = gốc của phạm vi), đường dẫn từ gốc tới nó, và các thư
 * mục con. Tài liệu trong cấp này lấy riêng qua {@code GET /documents?folderId=…} (có phân trang, bộ lọc).
 */
public record DocumentFolderListResponse(DocumentFolderResponse current, List<DocumentFolderResponse> breadcrumb,
                                         List<DocumentFolderResponse> folders, boolean canCreate) {}
