package com.kpitracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Giới hạn tần suất cho các endpoint xác thực (chống brute-force mật khẩu / OTP / spam email).
 *
 * <p>Bộ đếm nằm trong bộ nhớ của từng instance — đủ cho một backend chạy đơn lẻ sau nginx.
 * Nếu scale ngang thì mỗi instance đếm riêng, ngưỡng thực tế = ngưỡng × số instance.
 */
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit")
@Getter @Setter
public class RateLimitProperties {

    private boolean enabled = true;

    /**
     * Tin header {@code X-Forwarded-For} / {@code X-Real-IP} để lấy IP thật của client.
     * CHỈ bật khi backend đứng sau reverse proxy (nginx của dự án) — nếu client gọi thẳng
     * tới backend mà bật cờ này thì ai cũng tự đặt được IP giả để né giới hạn.
     */
    private boolean trustForwardedHeaders = false;

    /** Độ dài cửa sổ đếm, tính bằng giây. */
    private int windowSeconds = 60;

    /** Số request tối đa trong một cửa sổ cho từng IP, theo endpoint. */
    private int login = 20;
    private int register = 5;
    private int forgotPassword = 5;
    private int resetPassword = 10;
    private int verifyEmail = 20;
    private int resendVerification = 5;
    private int refreshToken = 60;
    private int lark = 30;
    private int changePassword = 10;

    /** Khoá tài khoản (theo email) sau {@code maxFailedLogins} lần sai trong {@code lockoutMinutes}. */
    private int maxFailedLogins = 10;
    private int lockoutMinutes = 15;
}
