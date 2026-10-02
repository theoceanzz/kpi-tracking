package com.kpitracking.dto.response.document;

import java.util.UUID;

/** Người hoặc đơn vị có thể nhận chia sẻ — chỉ tên + email/mô tả, không thêm thông tin nhân sự nào. */
public record ShareTargetResponse(String type, UUID id, String name, String detail) {}
