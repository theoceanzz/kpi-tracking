package com.kpitracking.exception;

/**
 * Người dùng đã tiêu hết hạn mức token AI được cấp trong tháng.
 *
 * <p>Khác hẳn {@link AiQuotaExceededException} — cái đó nghĩa là <b>nhà cung cấp AI</b> hết credit
 * (lỗi 429/402 từ phía họ). Cố tình tách làm hai lớp để đọc log là phân biệt được ngay lỗi của
 * khách hàng với lỗi của hệ thống.
 */
public class AiTokenQuotaExceededException extends RuntimeException {

    public AiTokenQuotaExceededException(String message) {
        super(message);
    }
}
