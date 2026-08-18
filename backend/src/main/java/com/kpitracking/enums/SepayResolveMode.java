package com.kpitracking.enums;

/** Cách người đối soát đóng một sự kiện SePay chưa xử lý. */
public enum SepayResolveMode {

    /** Người dùng ghi sai nội dung chuyển khoản nhưng xác định được đơn nào. */
    MATCH_ORDER,

    /** Không quy được về đơn nào: ghi có thẳng vào ví của người được chỉ định. */
    CREDIT_USER,

    /** Không phải tiền nạp ví, hoặc webhook về muộn sau khi đơn đã được gán tay. */
    IGNORE
}
