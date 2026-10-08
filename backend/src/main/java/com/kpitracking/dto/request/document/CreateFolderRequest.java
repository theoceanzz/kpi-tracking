package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Tạo thư mục: ở gốc của một phạm vi ({@code scope} + {@code orgUnitId} khi UNIT), hoặc trong {@code parentId}. */
public record CreateFolderRequest(DocumentScope scope, UUID orgUnitId, UUID parentId,
                                  @NotBlank @Size(max = 255) String name) {}
