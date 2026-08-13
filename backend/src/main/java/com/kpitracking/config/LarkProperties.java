package com.kpitracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình Lark ở cấp nền tảng — những giá trị thuộc về bản triển khai KeyGo, không thuộc về
 * từng công ty khách.
 *
 * <p>App ID / App Secret của mỗi công ty nằm trên bảng {@code organizations} (xem
 * {@code LarkCredentialResolver}), không cấu hình ở đây.
 */
@Configuration
@ConfigurationProperties(prefix = "lark")
@Getter @Setter
public class LarkProperties {

    /** URL callback của chính KeyGo, dùng chung cho cả đăng nhập lẫn kết nối tổ chức. */
    private String redirectUri;

    /** open.larksuite.com (quốc tế) hoặc open.feishu.cn (Trung Quốc). */
    private String openBaseUrl;

    /** accounts.larksuite.com (quốc tế) hoặc accounts.feishu.cn (Trung Quốc). */
    private String authBaseUrl;
}
