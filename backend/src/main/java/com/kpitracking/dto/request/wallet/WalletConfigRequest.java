package com.kpitracking.dto.request.wallet;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class WalletConfigRequest {

    /** Số đồng đổi được 1 điểm. */
    @NotNull(message = "Vui lòng nhập tỉ giá quy đổi")
    @Positive(message = "Tỉ giá quy đổi phải lớn hơn 0")
    private Long pointExchangeRate;

    @NotNull(message = "Vui lòng nhập số tiền nạp tối thiểu")
    @Positive(message = "Số tiền nạp tối thiểu phải lớn hơn 0")
    private Long topupMinAmount;

    @NotNull(message = "Vui lòng nhập số tiền nạp tối đa")
    @Positive(message = "Số tiền nạp tối đa phải lớn hơn 0")
    private Long topupMaxAmount;

    @NotNull(message = "Vui lòng nhập thời gian hiệu lực của đơn nạp")
    @Positive(message = "Thời gian hiệu lực phải lớn hơn 0 phút")
    private Integer topupExpireMinutes;

    private String sepayAccountNumber;

    private String sepayBankCode;

    private String sepayAccountHolder;
}
