package com.kpitracking.dto.request.wallet;

import lombok.Data;

/**
 * Payload webhook biến động số dư của SePay.
 *
 * <p>Cố ý KHÔNG có ràng buộc validation nào: một payload dị dạng vẫn phải được
 * ghi lại nguyên vẹn để đối soát chứ không được để bộ validate ném ra 400 rồi
 * mất dấu vết. Việc kiểm tra nằm trong service, sau khi đã lưu bản thô.
 */
@Data
public class SepayWebhookPayload {

    /** Id giao dịch phía SePay. Khoá chống nhận trùng khi SePay gửi lại. */
    private Long id;

    private String gateway;

    /** Dạng "yyyy-MM-dd HH:mm:ss", giờ Việt Nam. */
    private String transactionDate;

    private String accountNumber;

    private String subAccount;

    /** Mã đối soát SePay tự tách theo tiền tố cấu hình trên dashboard. Có thể null. */
    private String code;

    private String content;

    /** "in" là tiền vào, "out" là tiền ra. */
    private String transferType;

    private Long transferAmount;

    private Long accumulated;

    private String referenceCode;

    private String description;
}
