package com.kpitracking.dto.request.document;

import java.util.List;
import java.util.UUID;

/** Chia sẻ quyền XEM cho các người và/hoặc đơn vị (thành viên đơn vị và đơn vị con). */
public record ShareDocumentRequest(List<UUID> userIds, List<UUID> unitIds) {}
