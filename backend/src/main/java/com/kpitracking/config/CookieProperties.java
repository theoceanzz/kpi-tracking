package com.kpitracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Thuộc tính của cookie xác thực (kg_at / kg_rt).
 *
 * secure=false chỉ dùng cho dev qua http://localhost. Prod bắt buộc COOKIE_SECURE=true,
 * nếu không trình duyệt sẽ gửi token qua kết nối không mã hoá.
 */
@Configuration
@ConfigurationProperties(prefix = "app.cookie")
@Getter @Setter
public class CookieProperties {

    private boolean secure = false;

    /** Lax là đủ để chặn CSRF từ site khác vì mọi endpoint đổi trạng thái đều là POST/PUT/DELETE. */
    private String sameSite = "Lax";

    /** Để trống = host-only cookie, đúng cho trường hợp frontend và API chung một domain. */
    private String domain = "";
}
