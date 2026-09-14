package com.kpitracking.security;

import com.kpitracking.config.RateLimitProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;

/**
 * Khoá tạm tài khoản sau nhiều lần đăng nhập sai liên tiếp.
 *
 * <p>Đếm theo email (chuẩn hoá chữ thường) chứ không theo IP, để kẻ tấn công đổi IP vẫn không
 * thử tiếp được cùng một tài khoản; giới hạn theo IP nằm ở {@link AuthRateLimitFilter}.
 * Đăng nhập thành công thì xoá bộ đếm.
 */
@Service
@Slf4j
public class LoginAttemptService {

    private final RateLimitProperties props;
    private final SlidingWindowCounter failures;

    public LoginAttemptService(RateLimitProperties props) {
        this.props = props;
        this.failures = new SlidingWindowCounter(Duration.ofMinutes(Math.max(props.getLockoutMinutes(), 1)));
    }

    public boolean isLocked(String email) {
        if (!props.isEnabled() || email == null) return false;
        return failures.current(normalize(email)) >= props.getMaxFailedLogins();
    }

    public long lockSecondsRemaining(String email) {
        return email == null ? 0 : failures.secondsUntilReset(normalize(email));
    }

    public void recordFailure(String email, String ip) {
        if (!props.isEnabled() || email == null) return;
        int count = failures.increment(normalize(email));
        // Log để giám sát: không ghi mật khẩu, chỉ email + IP + số lần.
        if (count >= props.getMaxFailedLogins()) {
            log.warn("SECURITY login_locked email={} ip={} failures={} lockMinutes={}",
                    email, ip, count, props.getLockoutMinutes());
        } else if (count >= 3) {
            log.warn("SECURITY login_failed email={} ip={} failures={}", email, ip, count);
        }
    }

    public void recordSuccess(String email) {
        if (email != null) failures.reset(normalize(email));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
