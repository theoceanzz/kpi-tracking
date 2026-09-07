package com.kpitracking.dto.response.wallet;

import lombok.*;

import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WalletConfigResponse {

    private Boolean enableCashWallet;
    private Long pointExchangeRate;
    private Long topupMinAmount;
    private Long topupMaxAmount;
    private Integer topupExpireMinutes;
    private String sepayAccountNumber;
    private String sepayBankCode;
    private String sepayAccountHolder;

    /** Đã điền đủ tài khoản ngân hàng để tạo được đơn nạp hay chưa. */
    private Boolean bankConfigured;

    /**
     * Lần cuối nhận được webhook SePay về tài khoản của tổ chức này, {@code null}
     * nếu chưa lần nào.
     *
     * <p>Đây là bằng chứng DUY NHẤT cho việc đã nối xong với SePay. KeyGo không gọi
     * được API nào của SePay để kiểm tra tài khoản đã liên kết bên đó hay chưa, nên
     * nếu người cấu hình gõ nhầm số tài khoản thì mã QR sẽ trỏ vào một tài khoản
     * SePay không theo dõi: tiền đi thật mà không webhook nào về, đơn hết hạn, và
     * hàng đợi đối soát trống trơn vì chẳng có gì để hiện. Ô này là chỗ duy nhất
     * lỗi đó lộ ra trước khi có người mất tiền.
     */
    private Instant lastWebhookAt;
}
