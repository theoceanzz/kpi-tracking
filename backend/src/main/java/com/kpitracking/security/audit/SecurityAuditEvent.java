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
    /** Một người dính quá nhiều 403 trong thời gian ngắn — {@link ForbiddenBurstDetector}. */
    FORBIDDEN_BURST,
    /** Bị AuthRateLimitFilter chặn. */
    RATE_LIMITED,
    /** Thư viện tài liệu (docs/DOCUMENTS_DESIGN.md §10): tải lên, đổi phạm vi, xoá, tải về tài liệu đơn vị/công ty,
     *  admin xoá sớm tài liệu cá nhân của người bị vô hiệu hoá. Không ghi nội dung hay tên tệp cá nhân. */
    DOCUMENT_UPLOADED,
    DOCUMENT_SCOPE_CHANGED,
    DOCUMENT_DELETED,
    DOCUMENT_DOWNLOADED,
    DOCUMENT_PURGED,
    /** Chia sẻ quyền xem, gỡ chia sẻ, khôi phục từ thùng rác, xoá vĩnh viễn, khôi phục phiên bản cũ. */
    DOCUMENT_SHARED,
    DOCUMENT_UNSHARED,
    DOCUMENT_RESTORED,
    DOCUMENT_DELETED_PERMANENTLY,
    DOCUMENT_VERSION_RESTORED,
    /** Duyệt đề xuất đưa tài liệu lên đơn vị / công ty (bản sao ở phạm vi đích). */
    DOCUMENT_PROMOTED
}
