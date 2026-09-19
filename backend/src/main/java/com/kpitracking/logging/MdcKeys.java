package com.kpitracking.logging;

/**
 * Tên khoá MDC dùng chung. Mọi dòng log (text ở local, JSON ở prod) tự mang các khoá này;
 * audit log (security_audit_logs.request_id) và header phản hồi {@code X-Request-Id} cũng dùng
 * cùng giá trị, nên từ một mã lỗi người dùng báo tra được cả ba nơi.
 */
public final class MdcKeys {

    public static final String REQUEST_ID = "requestId";
    public static final String IP = "ip";
    public static final String METHOD = "method";
    public static final String PATH = "path";
    /** Email người đăng nhập — có sau JwtAuthenticationFilter. */
    public static final String USER = "user";
    public static final String USER_ID = "userId";
    public static final String ORG_ID = "orgId";
    /** Job nền: tên và id của lượt chạy (thay cho requestId). */
    public static final String JOB = "job";
    public static final String JOB_ID = "jobId";
    /** Phiên STOMP — log WebSocket sau handshake không có requestId, tra theo khoá này. */
    public static final String WS_SESSION = "wsSession";

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private MdcKeys() {
    }
}
