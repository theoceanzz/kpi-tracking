package com.kpitracking.enums;

/**
 * Loại bút toán trong sổ cái ví tiền.
 *
 * <p>KHÔNG có {@code REFUND}: bản đầu không có rút tiền cũng không có huỷ nạp nên
 * không luồng nào sinh ra nó, và một giá trị enum không ai tạo được chỉ gây hiểu
 * nhầm khi đọc. Thêm lại bằng migration mới khi thật sự cần thì rẻ.
 */
public enum CashTransactionType {

    /** Nạp tiền vào ví. Luôn dương. */
    TOPUP,

    /** Trừ tiền để đổi lấy điểm thưởng. Luôn âm. */
    CONVERT,

    /**
     * Ghi có tay cho một giao dịch SePay không quy được về đơn nạp nào. Chỉ
     * {@code SepayReconcileService} sinh ra, và luôn gắn với một sự kiện cụ thể —
     * không có đường tạo một khoản điều chỉnh tự do.
     */
    ADJUST
}
