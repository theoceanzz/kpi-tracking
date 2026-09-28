package com.kpitracking.enums;

/**
 * Trạng thái của kỳ đánh giá.
 *
 * <pre>
 * OPEN ──khoá kỳ──▶ LOCKED
 *   ▲                  │
 *   └──── mở lại ──────┘   (chỉ admin, bắt buộc lý do, không khi đã có đơn vị FINALIZED)
 * </pre>
 *
 * Không có trạng thái trung gian "đang khoá": thủ tục khoá chạy trong MỘT transaction và
 * giữ {@code FOR UPDATE} trên hàng kỳ từ đầu, còn mọi thao tác ghi vào kỳ giữ {@code FOR SHARE}
 * (xem {@link com.kpitracking.service.kpi.CycleStatusGuard}) — hai khoá này loại trừ nhau
 * nên không ai lọt vào giữa.
 */
public enum KpiCycleStatus {
    OPEN,
    LOCKED
}
