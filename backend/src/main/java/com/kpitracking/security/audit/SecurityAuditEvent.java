package com.kpitracking.security.audit;

/** Danh mục sự kiện bảo mật được ghi vào {@code security_audit_logs}. */
public enum SecurityAuditEvent {
    LOGIN_SUCCESS,
    LOGIN_FAILED,
    /** Tài khoản bị khoá tạm sau nhiều lần sai, hoặc cố đăng nhập khi đang bị khoá. */
    LOGIN_LOCKED,
    LOGOUT,
    PASSWORD_CHANGED,
    PASSWORD_RESET_REQUESTED,
    PASSWORD_RESET,
    /** Gán / gỡ quyền cho vai trò, gán vai trò cho người dùng. */
    PERMISSION_CHANGED,
    ROLE_ASSIGNED,
    /** Đổi cấu hình kết nối Lark (app id/secret, bật/tắt, kết nối, ngắt). */
    LARK_SETTINGS_CHANGED,
    /** Webhook SePay đã nhận (kể cả bị từ chối). */
    WALLET_WEBHOOK,
    /** Giao dịch ví do người dùng khởi tạo (nạp, quy đổi). */
    WALLET_TRANSACTION,
    /** 403 — thiếu quyền hoặc chạm vào dữ liệu tổ chức khác. */
    ACCESS_DENIED,
    /** Bị AuthRateLimitFilter chặn. */
    RATE_LIMITED
}
