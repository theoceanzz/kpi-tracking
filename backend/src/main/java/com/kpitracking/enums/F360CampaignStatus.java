package com.kpitracking.enums;

/**
 * Vòng đời chiến dịch đánh giá 360 (docs/FEEDBACK_360_DESIGN.md §4.1).
 *
 * <pre>
 * DRAFT ──launch──▶ NOMINATING ──start──▶ OPEN ──close──▶ CLOSED ──release──▶ RELEASED
 *                   (bỏ qua khi tắt đề cử)      ▲             │
 *                                               └── reopen ───┘
 * </pre>
 */
public enum F360CampaignStatus {
    DRAFT,
    NOMINATING,
    OPEN,
    CLOSED,
    RELEASED;

    /** Người chấm còn điền phiếu được ở trạng thái này không. */
    public boolean collecting() {
        return this == OPEN;
    }

    /** Kết quả đã được tính và chụp chưa. */
    public boolean hasResults() {
        return this == CLOSED || this == RELEASED;
    }
}
