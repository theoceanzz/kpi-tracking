package com.kpitracking.dto.response.document;

import java.util.UUID;

/**
 * Một đơn vị trong cây chọn người chia sẻ. {@code parentId = null} = đơn vị cấp đầu (con trực tiếp của đơn vị gốc — đơn vị
 * gốc không phải đích chia sẻ). {@code memberCount} = số người gắn TRỰC TIẾP vào đơn vị (không cộng đơn vị con).
 */
public record ShareUnitResponse(UUID id, String name, UUID parentId, long memberCount) {}
