package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Soạn một tài liệu trực tuyến mới (tệp {@code .kgdoc}). Có {@code folderId} thì phạm vi lấy theo thư mục.
 * {@code content}: tài liệu ({@code kind = doc}) là mảng khối JSON của BlockNote, bảng tính ({@code kind = sheet}) là
 * snapshot JSON của Univer; rỗng = trống, chỉ có tiêu đề.
 */
public record CreateOnlineDocumentRequest(DocumentScope scope, UUID orgUnitId, UUID folderId,
                                          @Size(max = 255) String title,
                                          String content,
                                          DocumentCategory category,
                                          Boolean aiEnabled,
                                          /** {@code doc} (mặc định) hay {@code sheet} (bảng tính). */
                                          String kind) {}
