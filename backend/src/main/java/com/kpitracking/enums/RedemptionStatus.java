package com.kpitracking.enums;

/**
 * Vòng đời một yêu cầu đổi quà.
 *
 * <p>Điểm bị trừ NGAY khi tạo yêu cầu (không phải khi được duyệt), và tồn kho cũng
 * bị giữ ngay. Nếu chỉ giữ chỗ mềm thì một người có 100 điểm có thể đặt năm yêu cầu
 * 100 điểm cùng lúc rồi được duyệt hết.
 */
public enum RedemptionStatus {
    /** Đã trừ điểm và giữ tồn kho, chờ người có GIFT:FULFILL xử lý. */
    PENDING,
    APPROVED,
    /** Từ chối ⇒ hoàn điểm (REFUND) và trả lại tồn kho. */
    REJECTED,
    DELIVERED,
    /** Người đổi tự huỷ khi còn PENDING ⇒ hoàn điểm và trả lại tồn kho. */
    CANCELLED,
    /**
     * Hệ thống ngoài (UrBox) không xuất được quà ⇒ điểm đã tự hoàn, tồn kho đã trả lại.
     *
     * <p>Cố ý KHÔNG dùng chung {@link #REJECTED}: nhân viên đọc lịch sử sẽ tưởng công ty
     * từ chối mình, còn người vận hành mất luôn con số "bao nhiêu đơn hỏng vì nhà cung cấp".
     */
    FAILED
}
