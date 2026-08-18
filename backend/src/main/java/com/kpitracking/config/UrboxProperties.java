package com.kpitracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Cấu hình kết nối kho quà eVoucher UrBox — thuộc về bản triển khai KeyGo, KHÔNG thuộc
 * về từng công ty khách.
 *
 * <p>KeyGo là đối tác ký hợp đồng với UrBox, mọi tổ chức trong hệ thống dùng chung một
 * cặp {@code app_id / app_secret}. Cái phân biệt tổ chức nào đổi quà là
 * {@code site_user_id} gửi kèm mỗi đơn (xem {@code UrboxOrderService}), không phải
 * credential riêng.
 *
 * <p>MẶC ĐỊNH TRỎ SANDBOX. Đổi sang PROD phải đặt cả {@code base-url} lẫn bộ credential
 * mới — để nguyên một nửa sẽ gửi đơn thật vào môi trường thử hoặc ngược lại.
 */
@Configuration
@ConfigurationProperties(prefix = "urbox")
@Getter @Setter
public class UrboxProperties {

    /**
     * Tắt là ẩn hẳn tính năng: không hiện tab kho quà UrBox, không nhận đơn đổi quà
     * ngoài. Mặc định TẮT để bản triển khai chưa ký hợp đồng không bày ra một màn hình
     * lúc nào cũng báo lỗi.
     */
    private boolean enabled = false;

    /** Sandbox: https://sandapi.urbox.dev — PROD do UrBox cấp riêng sau khi nghiệm thu. */
    private String baseUrl = "https://sandapi.urbox.dev";

    private String appId;

    private String appSecret;

    /**
     * Mã chương trình do UrBox tạo cho đối tác. Chỉ dùng khi đặt đơn; các API đọc kho
     * quà không cần.
     */
    private String campaignCode;

    /**
     * Private key PKCS#8 (PEM hoặc base64 trần) để ký đơn đổi quà bằng SHA256withRSA.
     *
     * <p>ĐỂ TRỐNG là không ký. Sandbox không kiểm chữ ký nên vẫn chạy được, nhưng PROD
     * bắt buộc — UrBox giữ public key tương ứng do đối tác gửi lên.
     */
    private String privateKey;

    /** Để UrBox tự nhắn tin mã quà cho nhân viên. Mặc định tắt: KeyGo tự hiển thị mã. */
    private boolean sendSms = false;

    /** Lấy link quà dạng rút gọn (s.urbox.vn) thay vì link đầy đủ. */
    private boolean shortenLink = true;

    private Duration connectTimeout = Duration.ofSeconds(10);

    /** UrBox công bố timeout 60s cho đơn đổi quà; để thấp hơn là tự cắt đơn đang chạy. */
    private Duration readTimeout = Duration.ofSeconds(60);

    /** Có đủ thứ để gọi UrBox chưa. Thiếu credential thì coi như chưa bật. */
    public boolean isConfigured() {
        return enabled
                && appId != null && !appId.isBlank()
                && appSecret != null && !appSecret.isBlank();
    }

    /** Đặt đơn còn cần thêm campaign_code, trong khi đọc kho quà thì không. */
    public boolean isOrderConfigured() {
        return isConfigured() && campaignCode != null && !campaignCode.isBlank();
    }
}
