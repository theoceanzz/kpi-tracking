package com.kpitracking.dto.request.document;

import jakarta.validation.constraints.Size;

/** Quyết định đề xuất. Duyệt: {@code title} (tuỳ chọn) đặt tên bản sao ở phạm vi đích. Từ chối: {@code note} = lý do. */
public record PromotionDecisionRequest(@Size(max = 255) String title, @Size(max = 2000) String note) {}
