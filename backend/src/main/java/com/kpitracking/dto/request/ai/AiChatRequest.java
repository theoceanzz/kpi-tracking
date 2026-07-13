package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String message;
    private String conversationId;
    /** Đơn vị đang xét (vd khi bấm thẻ Insight): đặt làm "đơn vị hiện tại" của lượt để tool nhắm đúng. */
    private String focusUnitId;
}
