package com.kpitracking.dto.response.document;

import com.kpitracking.enums.DocumentSharePermission;

import java.time.Instant;
import java.util.UUID;

/** Một lượt chia sẻ cho một người ({@code type = USER}) hoặc một đơn vị ({@code UNIT}), kèm mức quyền. */
public record DocumentShareResponse(UUID id, String type, UUID granteeId, String name, String detail,
                                    DocumentSharePermission permission, String grantedByName, Instant createdAt) {}
