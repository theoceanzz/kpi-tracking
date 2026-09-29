package com.kpitracking.exception;

/**
 * Dữ liệu đã đổi kể từ lúc người dùng xem (vd. có người vừa nộp/duyệt giữa bước kiểm tra và bước
 * khoá kỳ). Trả 409 để giao diện tải lại thay vì báo lỗi nghiệp vụ chung.
 */
public class StaleStateException extends BusinessException {
    public StaleStateException(String message) {
        super(message);
    }

    public StaleStateException(ErrorCode errorCode, Object... args) {
        super(errorCode, args);
    }
}
