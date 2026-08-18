package com.kpitracking.enums;

/** Kết quả phân loại tự động của một callback SePay. */
public enum SepayEventStatus {

    /** Đã khớp đơn và ghi có xong. */
    MATCHED,

    /**
     * Có tiền về nhưng chưa ghi có được: không trích được mã đơn, không tìm thấy
     * đơn, hoặc đơn đã thanh toán từ trước. Phải có người xử lý — im lặng bỏ qua
     * là nuốt tiền, mà ghi có tự động là trả hai lần.
     */
    UNMATCHED,

    /** SePay gửi lại một giao dịch đã nhận trước đó (trùng sepay_id). */
    DUPLICATE,

    /** Không phải tiền vào (chuyển đi), không liên quan tới nạp ví. */
    IGNORED
}
