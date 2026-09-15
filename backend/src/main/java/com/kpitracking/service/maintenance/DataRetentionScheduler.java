package com.kpitracking.service.maintenance;

import com.kpitracking.config.RetentionProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

/**
 * Dọn dữ liệu ghi liên tục theo chính sách ở {@link RetentionProperties}.
 *
 * <p>Nguyên tắc:
 * <ul>
 *   <li><b>Tắt mặc định</b> — bật bằng {@code APP_RETENTION_ENABLED=true} sau khi review.</li>
 *   <li>Xoá theo <b>lô nhỏ, mỗi lô một transaction</b> ({@code DELETE ... WHERE ctid IN (SELECT ctid
 *       ... LIMIT n)}): không giữ lock hàng phút, không tạo transaction/WAL khổng lồ, không làm
 *       replica (nếu có) trễ. Mỗi lần chạy tối đa {@code maxBatchesPerRun} lô — bảng tồn đọng
 *       nhiều sẽ được dọn dần qua nhiều lần.</li>
 *   <li>Cần index để câu con không seq scan: {@code refresh_tokens(expires_at)},
 *       {@code notifications(user_id, created_at DESC, id DESC)} / {@code (created_at)},
 *       {@code security_audit_logs(created_at DESC)} — xem {@code backend/db/ops/002,003}.</li>
 *   <li>Xoá bằng DELETE vẫn để lại dead tuple → cần autovacuum aggressive
 *       ({@code backend/db/ops/006}); với {@code security_audit_logs} đây chỉ là giải pháp tạm cho
 *       tới khi partition theo tháng (docs/DATABASE_SCALING.md P1) — khi đó thay bằng DROP PARTITION.</li>
 *   <li>Sổ cái ({@code cash_transactions}, {@code reward_transactions}) và
 *       {@code sepay_webhook_events} <b>không</b> nằm trong job này.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataRetentionScheduler {

    private final RetentionProperties props;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    /** Refresh token: chạy mỗi giờ — bảng này tăng nhanh nhất (mỗi login/refresh một dòng). */
    @Scheduled(cron = "0 15 * * * *")
    public void purgeRefreshTokens() {
        if (!props.isEnabled()) return;
        Instant now = Instant.now();
        Timestamp expiredBefore = Timestamp.from(now.minus(Duration.ofDays(props.getRefreshTokens().getExpiredDays())));
        Timestamp revokedBefore = Timestamp.from(now.minus(Duration.ofDays(props.getRefreshTokens().getRevokedDays())));

        long removed = deleteInBatches("refresh_tokens",
                "expires_at < ?", new Object[]{expiredBefore});
        removed += deleteInBatches("refresh_tokens",
                "revoked = TRUE AND created_at < ?", new Object[]{revokedBefore});
        if (removed > 0) log.info("Retention refresh_tokens: đã xoá {} dòng", removed);
    }

    /** Thông báo: 03:00 hằng ngày. */
    @Scheduled(cron = "0 0 3 * * *")
    public void purgeNotifications() {
        if (!props.isEnabled()) return;
        Instant now = Instant.now();
        Timestamp readBefore = Timestamp.from(now.minus(Duration.ofDays(props.getNotifications().getReadDays())));
        Timestamp unreadBefore = Timestamp.from(now.minus(Duration.ofDays(props.getNotifications().getUnreadDays())));

        long removed = deleteInBatches("notifications",
                "is_read = TRUE AND created_at < ?", new Object[]{readBefore});
        removed += deleteInBatches("notifications",
                "is_read = FALSE AND created_at < ?", new Object[]{unreadBefore});
        if (removed > 0) log.info("Retention notifications: đã xoá {} dòng", removed);
    }

    /** Nhật ký bảo mật: 03:30 hằng ngày. Giữ ≥ 180 ngày theo SECURITY_AUDIT.md. */
    @Scheduled(cron = "0 30 3 * * *")
    public void purgeSecurityAuditLogs() {
        if (!props.isEnabled()) return;
        Timestamp before = Timestamp.from(Instant.now().minus(Duration.ofDays(props.getSecurityAuditLogs().getDays())));

        long removed = deleteInBatches("security_audit_logs", "created_at < ?", new Object[]{before});
        if (removed > 0) log.info("Retention security_audit_logs: đã xoá {} dòng", removed);
    }

    /**
     * Xoá theo lô tới khi hết dòng khớp hoặc chạm {@code maxBatchesPerRun}. Mỗi lô là một
     * transaction riêng; lỗi ở một lô (vd. lock_timeout) dừng job, lần sau chạy tiếp.
     */
    long deleteInBatches(String table, String where, Object[] args) {
        String sql = "DELETE FROM " + table + " WHERE ctid IN (SELECT ctid FROM " + table
                + " WHERE " + where + " LIMIT " + props.getBatchSize() + ")";
        long total = 0;
        for (int i = 0; i < props.getMaxBatchesPerRun(); i++) {
            Integer deleted = tx.execute(status -> jdbc.update(sql, args));
            int n = deleted == null ? 0 : deleted;
            total += n;
            if (n < props.getBatchSize()) break;
        }
        if (total >= (long) props.getBatchSize() * props.getMaxBatchesPerRun()) {
            log.warn("Retention {}: chạm giới hạn {} lô/lần chạy, còn dòng tồn đọng — sẽ dọn tiếp lần sau",
                    table, props.getMaxBatchesPerRun());
        }
        return total;
    }
}
