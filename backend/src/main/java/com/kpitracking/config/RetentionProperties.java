package com.kpitracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Chính sách giữ dữ liệu cho các bảng ghi liên tục — đọc bởi
 * {@link com.kpitracking.service.maintenance.DataRetentionScheduler}.
 *
 * <p>MẶC ĐỊNH TẮT ({@code app.retention.enabled=false}). Bật trên prod chỉ sau khi đã chạy các
 * script index ở {@code backend/db/ops/} (002, 003) và xác nhận TTL với nghiệp vụ — xem
 * docs/DATABASE_SCALING.md C3 và bảng "Retention đề xuất".
 */
@Configuration
@ConfigurationProperties(prefix = "app.retention")
@Getter @Setter
public class RetentionProperties {

    private boolean enabled = false;

    /** Số dòng xoá mỗi lô (một transaction ngắn, giữ lock rất ngắn). */
    private int batchSize = 5000;

    /** Số lô tối đa mỗi lần job chạy; phần còn lại để lần sau — tránh một lần chạy kéo dài hàng giờ. */
    private int maxBatchesPerRun = 200;

    private RefreshTokens refreshTokens = new RefreshTokens();
    private Notifications notifications = new Notifications();
    private SecurityAuditLogs securityAuditLogs = new SecurityAuditLogs();

    @Getter @Setter
    public static class RefreshTokens {
        /** Token đã hết hạn quá N ngày. */
        private int expiredDays = 1;
        /** Token đã bị revoke (rotate / logout) quá N ngày. */
        private int revokedDays = 7;
    }

    @Getter @Setter
    public static class Notifications {
        /** Thông báo đã đọc, cũ hơn N ngày. */
        private int readDays = 90;
        /** Thông báo chưa đọc, cũ hơn N ngày. */
        private int unreadDays = 180;
    }

    @Getter @Setter
    public static class SecurityAuditLogs {
        /** Quy ước ≥ 180 ngày (docs/SECURITY_AUDIT.md). */
        private int days = 180;
    }
}
