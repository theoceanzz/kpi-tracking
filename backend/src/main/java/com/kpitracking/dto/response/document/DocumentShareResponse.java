package com.kpitracking.dto.response.document;

import java.time.Instant;
import java.util.UUID;

/** Một lượt chia sẻ quyền XEM: cho một người ({@code type = USER}) hoặc một đơn vị ({@code UNIT}). */
public record DocumentShareResponse(UUID id, String type, UUID granteeId, String name, String detail,
                                    String grantedByName, Instant createdAt) {}
