package com.kpitracking.dto.request.wallet;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class WalletConfigRequest {

    /** Số đồng đổi được 1 điểm. */
    @NotNull(message = "{validation.enterConversionRate}")
    @Positive(message = "{validation.conversionRateMustGreaterThan0}")
    private Long pointExchangeRate;

    @NotNull(message = "{validation.enterMinimumTopUpAmount}")
    @Positive(message = "{validation.minimumTopUpAmountMustGreaterThan0}")
    private Long topupMinAmount;

    @NotNull(message = "{validation.enterMaximumTopUpAmount}")
    @Positive(message = "{validation.maximumTopUpAmountMustGreaterThan0}")
    private Long topupMaxAmount;

    @NotNull(message = "{validation.enterValidityTimeTopUpOrders}")
    @Positive(message = "{validation.validityTimeMustGreaterThan0Minutes}")
    private Integer topupExpireMinutes;

    private String sepayAccountNumber;

    private String sepayBankCode;

    private String sepayAccountHolder;

    // ===== Hồ sơ pháp nhân & biên nhận thu tiền =====
    //
    // Nằm chung với cấu hình ví thay vì tách một màn hình riêng: người đi khai số tài khoản nhận
    // tiền cũng chính là người biết mã số thuế và địa chỉ pháp nhân, và hai việc đó phải xong
    // cùng nhau thì biên nhận đầu tiên mới đủ nội dung.

    /** Bỏ trống thì hệ thống dùng tên tổ chức. */
    private String legalName;

    private String taxCode;

    private String businessAddress;

    private String contactPhone;

    /** Gửi biên nhận cho mỗi lần nạp thành công. Null giữ nguyên giá trị đang có. */
    private Boolean receiptEnabled;

    /** Tiền tố ký hiệu chứng từ; ký hiệu đầy đủ là tiền tố + năm lập, VD PT2026. */
    private String receiptSeriesPrefix;

    /**
     * Thuế suất % áp cho khoản nạp ví. Mặc định 0 — nạp ví là khoản thu trước, nghĩa vụ thuế
     * phát sinh khi nhân viên đổi điểm lấy quà.
     */
    @Min(value = 0, message = "{validation.taxRateCannotLessThan0Percent}")
    @Max(value = 100, message = "{validation.taxRateCannotGreaterThan100Percent}")
    private Integer receiptVatRate;

    private String receiptIssuerName;

    private String receiptIssuerTitle;
}
