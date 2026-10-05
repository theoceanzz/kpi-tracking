package com.kpitracking.dto.response.orgunit;

import java.util.UUID;

/** Một nút trong chuỗi đơn vị của tôi → cha → … → gốc. {@code parentId} null = gốc (công ty). */
public record OrgUnitChainItem(UUID id, String name, UUID parentId) {}
