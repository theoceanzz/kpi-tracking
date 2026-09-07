package com.kpitracking.enums;

/**
 * Trạng thái đơn nạp tiền.
 *
 * <p>{@link #CANCELLED} và {@link #EXPIRED} <b>không phải trạng thái cuối</b>.
 * Webhook cố ý vẫn ghi có cho chúng: tiền đã về tài khoản thì phải ghi nhận, hết
 * hạn hay đã huỷ không phải cớ để nuốt tiền của người dùng. Nên một đơn ở hai
 * trạng thái này vẫn có thể chuyển sang {@link #PAID} về sau, và giao diện không
 * được ẩn hay khoá cứng chúng.
 */
public enum TopupOrderStatus {

    PENDING,
    PAID,
    EXPIRED,
    CANCELLED
}
