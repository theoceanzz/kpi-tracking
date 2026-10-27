package com.kpitracking.service.approvalprocess;

public enum ConditionOperator {
    /** Thuộc một trong các giá trị. */
    IN,
    NOT_IN,
    /** Đơn vị thuộc một trong các đơn vị đã chọn, kể cả đơn vị con. */
    IN_SUBTREE,
    EQ, NEQ, GT, GTE, LT, LTE,
    IS_TRUE, IS_FALSE;

    /** Toán tử không cần giá trị so sánh. */
    public boolean unary() {
        return this == IS_TRUE || this == IS_FALSE;
    }
}
