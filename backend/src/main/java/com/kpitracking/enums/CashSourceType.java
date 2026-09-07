package com.kpitracking.enums;

/** Nguồn gốc nghiệp vụ của một bút toán ví tiền. */
public enum CashSourceType {

    /** Webhook biến động số dư của SePay. */
    SEPAY,

    /** Quy đổi tiền sang điểm thưởng. */
    CONVERSION,

    /** Thao tác tay của người đối soát. */
    MANUAL,

    /** Hệ thống tự sinh. Chừa sẵn, chưa dùng. */
    SYSTEM
}
