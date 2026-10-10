package com.kpitracking.security.audit;

import com.kpitracking.entity.SecurityAuditLog;
import com.kpitracking.entity.User;
import com.kpitracking.repository.SecurityAuditLogRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.AuthRateLimitFilter;
import com.kpitracking.security.PermissionChecker;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Set;
import java.util.UUID;

/**
 * Ghi nhật ký bảo mật có cấu trúc: vừa xuống bảng {@code security_audit_logs}, vừa ra log
 * dạng {@code SECURITY event=... user=... org=... ip=...} để hệ thống thu log ngoài (Loki,
 * CloudWatch…) lọc được mà không cần vào DB. Dòng log: thành công ở INFO, thất bại/bị chặn ở WARN; bỏ trường
 * rỗng; email che bớt ({@code ng***@gmail.com}) — bảng DB vẫn giữ email đầy đủ.
 *
 * <p>Nguyên tắc:
 * <ul>
 *   <li><b>Không bao giờ</b> đưa mật khẩu, token, OTP, secret vào {@code detail}.</li>
 *   <li>Chạy trong transaction riêng ({@code REQUIRES_NEW}): đăng nhập sai ném exception làm
 *       transaction ngoài rollback, nhưng dòng log vẫn phải còn.</li>
 *   <li>Không được làm hỏng nghiệp vụ chính: mọi lỗi ghi log bị nuốt và chỉ báo ra {@code log.error}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityAuditService {

    public static final String OK = "SUCCESS";
    public static final String FAIL = "FAILURE";
    public static final String BLOCKED = "BLOCKED";

    private final SecurityAuditLogRepository repository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;
    private final ForbiddenBurstDetector forbiddenBurstDetector;
    private final ForbiddenBurstAlerter forbiddenBurstAlerter;

    // ── API tiện dụng cho các nơi gọi ────────────────────────────────────────

    /** Sự kiện của người đang đăng nhập (lấy user/org/ip/user-agent từ ngữ cảnh request). */
    public void record(SecurityAuditEvent event, String outcome, String targetType, String targetId, String detail) {
        User me = currentUser();
        write(event, outcome, me, me != null ? me.getEmail() : null, targetType, targetId, detail);
    }

    /** Sự kiện gắn với một email cụ thể — dùng khi chưa có phiên (đăng nhập, quên mật khẩu). */
    public void recordForEmail(SecurityAuditEvent event, String outcome, String email, String detail) {
        User user = email == null ? null : userRepository.findByEmail(email).orElse(null);
        write(event, outcome, user, email, null, null, detail);
    }

    /** Sự kiện không có người dùng (webhook, rate limit) — vẫn ghi ip/user-agent. */
    public void recordAnonymous(SecurityAuditEvent event, String outcome, String targetType, String targetId, String detail) {
        write(event, outcome, null, null, targetType, targetId, detail);
    }

    // ── lõi ─────────────────────────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(SecurityAuditEvent event, String outcome, User user, String email,
                      String targetType, String targetId, String detail) {
        UUID userId = user != null ? user.getId() : null;
        UUID orgId = user != null ? primaryOrganizationId(user.getId()) : null;
        // Đọc ngay đầu method, cùng thread với người gọi (REQUIRES_NEW không đổi thread).
        String requestId = org.slf4j.MDC.get(com.kpitracking.logging.MdcKeys.REQUEST_ID);
        HttpServletRequest req = currentRequest();
        String ip = req != null ? clientIp(req) : null;
        String userAgent = req != null ? truncate(req.getHeader("User-Agent"), 512) : null;

        String line = logLine(event, outcome, email, orgId, ip, requestId, targetType, targetId, detail);
        if (OK.equals(outcome)) log.info(line);
        else log.warn(line);

        try {
            repository.save(SecurityAuditLog.builder()
                    .event(event.name())
                    .outcome(outcome)
                    .userId(userId)
                    .userEmail(truncate(email, 255))
                    .organizationId(orgId)
                    .ip(truncate(ip, 64))
                    .userAgent(userAgent)
                    .requestId(truncate(requestId, 64))
                    .targetType(truncate(targetType, 64))
                    .targetId(truncate(targetId, 128))
                    .detail(truncate(detail, 1000))
                    .build());
        } catch (Exception e) {
            // Nhật ký không được kéo đổ nghiệp vụ; log ra đã đủ để không mất dấu vết.
            log.error("Không ghi được security_audit_logs: {}", e.getMessage());
        }

        // 403 dồn dập từ một người ⇒ cảnh báo sớm (thường là frontend gọi API vượt quyền).
        if (event == SecurityAuditEvent.ACCESS_DENIED) {
            try {
                String who = email != null ? email : (userId != null ? userId.toString() : null);
                ForbiddenBurstDetector.Burst burst = forbiddenBurstDetector.record(who, targetId);
                if (burst != null) {
                    write(SecurityAuditEvent.FORBIDDEN_BURST, BLOCKED, user, email, "HTTP", null,
                            burst.count() + " x 403 / " + burst.windowSeconds() + "s: " + burst.endpoints());
                    // Prod (Coolify) không có chỗ gom log ⇒ báo qua email.
                    forbiddenBurstAlerter.send(burst, orgId != null ? orgId.toString() : null, ip);
                }
            } catch (Exception e) {
                log.error("Không đếm được 403 dồn dập: {}", e.getMessage());
            }
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    private UUID primaryOrganizationId(UUID userId) {
        try {
            Set<UUID> orgs = permissionChecker.organizationIdsOf(userId);
            return orgs.isEmpty() ? null : orgs.iterator().next();
        } catch (Exception e) {
            return null;
        }
    }

    private static HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes sra ? sra.getRequest() : null;
    }

    /** Cùng cách đọc với AuthRateLimitFilter: bỏ hop proxy nội bộ, lấy IP công khai gần client nhất. */
    public static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] hops = xff.split(",");
            for (int i = hops.length - 1; i >= 0; i--) {
                String hop = hops[i].trim();
                if (!hop.isEmpty() && !AuthRateLimitFilter.isPrivate(hop)) return hop;
            }
            return hops[0].trim();
        }
        return req.getRemoteAddr();
    }

    /** {@code SECURITY event=… outcome=… [user=…] [org=…] [ip=…] [requestId=…] [target=…] [detail=…]} — trường null bị bỏ. */
    static String logLine(SecurityAuditEvent event, String outcome, String email, UUID orgId, String ip,
                          String requestId, String targetType, String targetId, String detail) {
        StringBuilder sb = new StringBuilder("SECURITY event=").append(event).append(" outcome=").append(outcome);
        append(sb, "user", maskEmail(email));
        append(sb, "org", orgId);
        append(sb, "ip", ip);
        append(sb, "requestId", requestId);
        if (targetType != null || targetId != null) {
            append(sb, "target", (targetType != null ? targetType : "") + (targetId != null ? ":" + targetId : ""));
        }
        append(sb, "detail", detail);
        return sb.toString();
    }

    private static void append(StringBuilder sb, String key, Object value) {
        if (value == null || value.toString().isBlank()) return;
        sb.append(' ').append(key).append('=').append(value.toString().replaceAll("\\p{Cntrl}", "_"));
    }

    /** {@code nguyenvana@gmail.com} → {@code ng***@gmail.com}: đủ đối chiếu với bảng DB, log lộ ra không lộ danh sách email. */
    static String maskEmail(String email) {
        if (email == null || email.isBlank()) return null;
        int at = email.indexOf('@');
        if (at < 0) return email.length() <= 2 ? "***" : email.substring(0, 2) + "***";
        String local = email.substring(0, at);
        return (local.length() <= 2 ? local.substring(0, Math.min(1, local.length())) : local.substring(0, 2))
                + "***" + email.substring(at);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
