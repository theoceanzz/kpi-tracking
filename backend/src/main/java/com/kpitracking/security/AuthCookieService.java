package com.kpitracking.security;

import com.kpitracking.config.CookieProperties;
import com.kpitracking.config.JwtConfig;
import com.kpitracking.dto.response.auth.AuthResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.Arrays;

/**
 * Đọc/ghi cặp cookie xác thực.
 *
 * Token nằm trong cookie HttpOnly nên JavaScript không đọc được — XSS không trích xuất được phiên.
 * Dùng ResponseCookie (Spring) chứ không dùng jakarta Cookie vì chỉ ResponseCookie set được SameSite.
 */
@Service
@RequiredArgsConstructor
public class AuthCookieService {

    public static final String ACCESS_COOKIE = "kg_at";
    public static final String REFRESH_COOKIE = "kg_rt";

    /** Access token đi kèm mọi request, kể cả handshake WebSocket ở /ws. */
    private static final String ACCESS_PATH = "/";
    /** Refresh token chỉ cần cho /auth/refresh-token và /auth/logout — thu hẹp bề mặt tấn công. */
    private static final String REFRESH_PATH = "/api/v1/auth";

    private final CookieProperties cookieProperties;
    private final JwtConfig jwtConfig;

    /**
     * Ghi cả hai cookie. Bỏ qua token rỗng: register() trả accessToken="" vì tài khoản
     * còn phải xác thực email trước khi có phiên.
     */
    public void writeAuthCookies(HttpServletResponse response, AuthResponse auth) {
        if (StringUtils.hasText(auth.getAccessToken())) {
            addCookie(response, ACCESS_COOKIE, auth.getAccessToken(), ACCESS_PATH,
                    Duration.ofMillis(jwtConfig.getAccessTokenExpiry()));
        }
        if (StringUtils.hasText(auth.getRefreshToken())) {
            addCookie(response, REFRESH_COOKIE, auth.getRefreshToken(), REFRESH_PATH,
                    Duration.ofMillis(jwtConfig.getRefreshTokenExpiry()));
        }
    }

    /** Xoá cookie: phải trùng tên VÀ Path thì trình duyệt mới ghi đè đúng cookie cũ. */
    public void clearAuthCookies(HttpServletResponse response) {
        addCookie(response, ACCESS_COOKIE, "", ACCESS_PATH, Duration.ZERO);
        addCookie(response, REFRESH_COOKIE, "", REFRESH_PATH, Duration.ZERO);
    }

    public String readAccessToken(HttpServletRequest request) {
        return readCookie(request, ACCESS_COOKIE);
    }

    public String readRefreshToken(HttpServletRequest request) {
        return readCookie(request, REFRESH_COOKIE);
    }

    private void addCookie(HttpServletResponse response, String name, String value,
                           String path, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieProperties.isSecure())
                .sameSite(cookieProperties.getSameSite())
                .path(path)
                .maxAge(maxAge);

        if (StringUtils.hasText(cookieProperties.getDomain())) {
            builder.domain(cookieProperties.getDomain());
        }

        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        return Arrays.stream(cookies)
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }
}
