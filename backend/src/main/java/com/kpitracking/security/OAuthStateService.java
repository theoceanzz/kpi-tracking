package com.kpitracking.security;

import com.kpitracking.config.JwtConfig;
import com.kpitracking.exception.BusinessException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

/**
 * Sinh và kiểm tra tham số {@code state} của luồng OAuth Lark.
 *
 * <p>Backend stateless nên state được ký thành JWT ngắn hạn thay vì lưu server-side. State mang
 * theo {@code orgId} — nhờ chữ ký nên người dùng không sửa được để trỏ sang công ty khác — và
 * {@code purpose} để phân biệt đăng nhập với kết nối tổ chức, nhờ đó
 * <b>chỉ cần khai báo một redirect URL duy nhất</b> trong ứng dụng Lark của khách hàng.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuthStateService {

    private static final String PURPOSE_CLAIM = "purpose";
    private static final String ORG_CLAIM = "org";
    private static final long STATE_TTL_MILLIS = 5 * 60 * 1000L;

    /** Token trung gian giữ tenant_key giữa bước /connect và /connect/confirm. */
    private static final String TENANT_KEY_CLAIM = "tk";
    private static final String TENANT_NAME_CLAIM = "tn";
    private static final String TENANT_AVATAR_CLAIM = "ta";
    private static final String PENDING_PURPOSE = "lark_connect_pending";

    private final JwtConfig jwtConfig;

    public enum Purpose {
        /** Nhân viên đăng nhập vào KeyGo. */
        LOGIN,
        /** Quản trị viên liên kết tổ chức với Lark. */
        CONNECT
    }

    public record StateData(UUID organizationId, Purpose purpose) {
    }

    public record PendingConnection(UUID organizationId, String tenantKey,
                                    String tenantName, String tenantAvatarUrl) {
    }

    public String generateLarkState(UUID organizationId, Purpose purpose) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .claim(PURPOSE_CLAIM, purpose.name())
                .claim(ORG_CLAIM, organizationId.toString())
                .issuedAt(new Date(now))
                .expiration(new Date(now + STATE_TTL_MILLIS))
                .signWith(getSignInKey(), Jwts.SIG.HS512)
                .compact();
    }

    public StateData validateLarkState(String state) {
        Claims claims = parse(state);
        String purposeRaw = claims.get(PURPOSE_CLAIM, String.class);
        String orgRaw = claims.get(ORG_CLAIM, String.class);

        if (purposeRaw == null || orgRaw == null) {
            throw new BusinessException("Phiên đăng nhập Lark không hợp lệ. Vui lòng thử lại.");
        }
        try {
            return new StateData(UUID.fromString(orgRaw), Purpose.valueOf(purposeRaw));
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Phiên đăng nhập Lark không hợp lệ. Vui lòng thử lại.");
        }
    }

    /**
     * Gói tenant_key vừa lấy được vào một token ký ngắn hạn để trả cho trình duyệt xác nhận,
     * nhờ đó giá trị thật không bao giờ rời khỏi backend.
     */
    public String generatePendingConnection(UUID organizationId, String tenantKey,
                                            String tenantName, String tenantAvatarUrl) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .claim(PURPOSE_CLAIM, PENDING_PURPOSE)
                .claim(ORG_CLAIM, organizationId.toString())
                .claim(TENANT_KEY_CLAIM, tenantKey)
                .claim(TENANT_NAME_CLAIM, tenantName)
                .claim(TENANT_AVATAR_CLAIM, tenantAvatarUrl)
                .issuedAt(new Date(now))
                .expiration(new Date(now + STATE_TTL_MILLIS))
                .signWith(getSignInKey(), Jwts.SIG.HS512)
                .compact();
    }

    public PendingConnection validatePendingConnection(String token) {
        Claims claims = parse(token);
        if (!PENDING_PURPOSE.equals(claims.get(PURPOSE_CLAIM, String.class))) {
            throw new BusinessException("Phiên kết nối Lark không hợp lệ. Vui lòng thử lại.");
        }
        return new PendingConnection(
                UUID.fromString(claims.get(ORG_CLAIM, String.class)),
                claims.get(TENANT_KEY_CLAIM, String.class),
                claims.get(TENANT_NAME_CLAIM, String.class),
                claims.get(TENANT_AVATAR_CLAIM, String.class));
    }

    private Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSignInKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("State Lark không hợp lệ: {}", e.getMessage());
            throw new BusinessException(
                    "Phiên đăng nhập Lark đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.");
        }
    }

    private SecretKey getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtConfig.getSecret());
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
