package com.kpitracking.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.config.RateLimitProperties;
import com.kpitracking.dto.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.function.ToIntFunction;

/**
 * Giới hạn tần suất theo IP cho các endpoint xác thực.
 *
 * <p>Chạy TRƯỚC {@link JwtAuthenticationFilter}: các endpoint này đều public, không có phiên
 * để nhận diện người gọi, nên IP là thứ duy nhất để đếm. Vượt ngưỡng trả 429 kèm
 * {@code Retry-After}; phần thân JSON dùng cùng {@code ApiResponse} như mọi lỗi khác.
 */
@Component
@Slf4j
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final String PREFIX = "/api/v1/auth/";

    /** Đường dẫn (sau /api/v1/auth/) → ngưỡng cấu hình. Chỉ POST/GET mới đếm, OPTIONS đi qua. */
    private final Map<String, ToIntFunction<RateLimitProperties>> limits = Map.of(
            "login", RateLimitProperties::getLogin,
            "register", RateLimitProperties::getRegister,
            "forgot-password", RateLimitProperties::getForgotPassword,
            "reset-password", RateLimitProperties::getResetPassword,
            "verify-email", RateLimitProperties::getVerifyEmail,
            "resend-verification", RateLimitProperties::getResendVerification,
            "refresh-token", RateLimitProperties::getRefreshToken,
            "change-password", RateLimitProperties::getChangePassword
    );

    private final RateLimitProperties props;
    private final ObjectMapper objectMapper;
    private final SlidingWindowCounter counter;

    private final org.springframework.beans.factory.ObjectProvider<com.kpitracking.security.audit.SecurityAuditService> audit;

    public AuthRateLimitFilter(RateLimitProperties props, ObjectMapper objectMapper,
                               org.springframework.beans.factory.ObjectProvider<com.kpitracking.security.audit.SecurityAuditService> audit) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.audit = audit;
        this.counter = new SlidingWindowCounter(Duration.ofSeconds(Math.max(props.getWindowSeconds(), 1)));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!props.isEnabled()) return true;
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        return resolveBucket(request.getServletPath()) == null;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String bucket = resolveBucket(request.getServletPath());
        int limit = limits.getOrDefault(bucket, RateLimitProperties::getLark).applyAsInt(props);
        String ip = clientIp(request);
        String key = bucket + "|" + ip;

        int hits = counter.increment(key);
        if (hits > limit) {
            long retryAfter = Math.max(counter.secondsUntilReset(key), 1);
            // Chỉ ghi một dòng cho mỗi cửa sổ bị vượt, không ghi mỗi request bị chặn.
            if (hits == limit + 1) {
                com.kpitracking.security.audit.SecurityAuditService svc = audit.getIfAvailable();
                if (svc != null) {
                    svc.recordAnonymous(com.kpitracking.security.audit.SecurityAuditEvent.RATE_LIMITED,
                            com.kpitracking.security.audit.SecurityAuditService.BLOCKED,
                            "ENDPOINT", "/auth/" + bucket, "Vượt " + limit + " request/" + props.getWindowSeconds() + "s");
                } else {
                    log.warn("SECURITY rate_limited endpoint=/auth/{} ip={} limit={}/{}s", bucket, ip, limit, props.getWindowSeconds());
                }
            }
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            com.kpitracking.logging.RequestIdResponseAdvice.writeError(response,
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    "Bạn thao tác quá nhanh. Vui lòng thử lại sau " + retryAfter + " giây.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** Tên bucket cho đường dẫn, hoặc {@code null} nếu endpoint này không bị giới hạn. */
    private String resolveBucket(String path) {
        if (path == null || !path.startsWith(PREFIX)) return null;
        String rest = path.substring(PREFIX.length());
        if (rest.startsWith("lark/")) return "lark";
        return limits.containsKey(rest) ? rest : null;
    }

    /**
     * IP client khi đứng sau reverse proxy.
     *
     * <p>Chuỗi proxy trên Coolify là {@code Traefik → nginx (frontend) → backend}, mỗi tầng
     * NỐI THÊM địa chỉ nó nhìn thấy vào {@code X-Forwarded-For}. Lấy hop cuối thì ra IP của
     * Traefik/nginx và mọi người dùng bị đếm chung một bucket. Vì vậy duyệt từ phải sang trái,
     * BỎ QUA các địa chỉ nội bộ (docker network, loopback, link-local) và lấy địa chỉ công khai
     * đầu tiên gặp được — đó là hop do proxy ngoài cùng ghi. Traefik xoá header giả từ client
     * nên phần tử còn lại là đáng tin.
     */
    private String clientIp(HttpServletRequest request) {
        if (props.isTrustForwardedHeaders()) {
            String xff = request.getHeader("X-Forwarded-For");
            if (StringUtils.hasText(xff)) {
                String[] hops = xff.split(",");
                for (int i = hops.length - 1; i >= 0; i--) {
                    String hop = hops[i].trim();
                    if (!hop.isEmpty() && !isPrivate(hop)) return hop;
                }
                String first = hops[0].trim();
                if (!first.isEmpty()) return first;
            }
            String realIp = request.getHeader("X-Real-IP");
            if (StringUtils.hasText(realIp)) return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    /** RFC1918 / loopback / link-local / IPv6 ULA — địa chỉ của các tầng proxy nội bộ. */
    public static boolean isPrivate(String ip) {
        // Chỉ nhận literal IP: getByName với hostname sẽ đi tra DNS — không để header điều khiển việc đó.
        if (!ip.matches("[0-9a-fA-F:.]+")) return false;
        try {
            java.net.InetAddress addr = java.net.InetAddress.getByName(ip);
            return addr.isSiteLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                    || addr.isAnyLocalAddress()
                    || (addr instanceof java.net.Inet6Address && (addr.getAddress()[0] & 0xfe) == 0xfc);
        } catch (java.net.UnknownHostException e) {
            return false;
        }
    }
}
