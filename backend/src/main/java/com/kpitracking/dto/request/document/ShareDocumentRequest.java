package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentSharePermission;

import java.util.List;
import java.util.UUID;

/**
 * Chia sẻ cho các người và/hoặc đơn vị (thành viên đơn vị và đơn vị con). {@code permission} bỏ trống = chỉ xem;
 * người / đơn vị đã được chia sẻ thì cập nhật sang mức quyền này.
 */
public record ShareDocumentRequest(List<UUID> userIds, List<UUID> unitIds, DocumentSharePermission permission) {}
