package com.kpitracking.dto.response.document;

import com.kpitracking.enums.DocumentScope;

import java.time.Instant;
import java.util.UUID;

/** Một thư mục trong Drive của thư viện tài liệu. */
public record DocumentFolderResponse(UUID id, String name, DocumentScope scope, UUID orgUnitId, String orgUnitName,
                                     UUID parentId, boolean canEdit, Instant createdAt, String createdByName) {}
