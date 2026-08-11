package com.kpitracking.dto.response.ai;

import lombok.*;

/** Hạn mức của chính người đang đăng nhập — hiện ở widget chat và trang trợ lý AI. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiQuotaStatusResponse {

    /** Hạn mức được cấp trong tháng. */
    private Long monthlyLimit;

    /** Phần đã chia cho cấp dưới (nếu là quản lý) — không tự tiêu được nữa. */
    private Long allocatedToOthers;

    /** Phần thực sự tự tiêu được = monthlyLimit - allocatedToOthers. */
    private Long spendable;

    private Long used;
    private Long remaining;
}
