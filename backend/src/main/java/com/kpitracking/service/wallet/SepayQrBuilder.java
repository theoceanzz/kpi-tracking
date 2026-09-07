package com.kpitracking.service.wallet;

import com.kpitracking.entity.Organization;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Dựng URL ảnh VietQR của SePay.
 *
 * <p>Không gọi API nào và không cần khoá bí mật nào — đây chỉ là một URL ảnh để
 * đặt vào thẻ {@code <img>}. Nhờ vậy việc tạo đơn nạp không phụ thuộc vào một
 * dịch vụ ngoài: nếu qr.sepay.vn tạm hỏng thì người dùng vẫn có đủ số tài khoản
 * và nội dung chuyển khoản để tự nhập tay.
 */
@Component
public class SepayQrBuilder {

    private static final String BASE = "https://qr.sepay.vn/img";

    public String build(Organization org, long amount, String code) {
        if (org.getSepayAccountNumber() == null || org.getSepayBankCode() == null) {
            return null;
        }
        return BASE
                + "?acc=" + enc(org.getSepayAccountNumber())
                + "&bank=" + enc(org.getSepayBankCode())
                + "&amount=" + amount
                + "&des=" + enc(code);
    }

    private String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }
}
