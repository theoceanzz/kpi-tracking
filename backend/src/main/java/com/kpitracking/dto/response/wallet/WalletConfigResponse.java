package com.kpitracking.dto.response.wallet;

import lombok.*;

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
}
