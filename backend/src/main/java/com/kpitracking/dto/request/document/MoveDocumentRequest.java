package com.kpitracking.dto.request.document;

import java.util.UUID;

/** Chuyển tài liệu vào thư mục ({@code folderId}) cùng phạm vi; {@code null} = về gốc của phạm vi. */
public record MoveDocumentRequest(UUID folderId) {}
