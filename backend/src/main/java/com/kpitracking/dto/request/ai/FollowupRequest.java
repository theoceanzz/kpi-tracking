package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FollowupRequest {
    /** Optional — used only for logging/correlation. */
    private String conversationId;
    /** 0 = fixed templates (no AI); ≥1 = AI-generated pools. */
    private Integer turn;
    /** Compact description of the active insight + last question/answer, used as LLM context. */
    private String context;
}
