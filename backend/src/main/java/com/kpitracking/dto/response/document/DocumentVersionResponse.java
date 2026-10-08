package com.kpitracking.dto.response.document;

import java.time.Instant;
import java.util.UUID;

/** Một phiên bản của tệp tài liệu. {@code current = true} là bản đang dùng (id = id tài liệu). */
public record DocumentVersionResponse(UUID id, int version, String fileName, long fileSize, Instant createdAt,
                                      String createdByName, boolean current) {}
