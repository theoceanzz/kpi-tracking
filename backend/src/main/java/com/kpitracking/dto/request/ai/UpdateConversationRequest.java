package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Sửa một phần: trường nào null thì giữ nguyên. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateConversationRequest {
    private String title;
    private Boolean pinned;
}
