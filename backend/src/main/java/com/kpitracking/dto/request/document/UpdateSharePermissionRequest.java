package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentSharePermission;
import jakarta.validation.constraints.NotNull;

/** Đổi mức quyền của một lượt chia sẻ (xem ↔ chỉnh sửa). */
public record UpdateSharePermissionRequest(@NotNull DocumentSharePermission permission) {}
