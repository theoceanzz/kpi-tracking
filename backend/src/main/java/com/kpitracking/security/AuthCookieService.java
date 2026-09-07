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
import java.util.List;

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
    /** Token CSRF. Không dùng tên mặc định XSRF-TOKEN — xem CSRF_COOKIE ở SecurityConfig. */
    public static final String CSRF_COOKIE = "kg_csrf";

    /** Access token đi kèm mọi request, kể cả handshake WebSocket ở /ws. */
    public static final String ACCESS_PATH = "/";
    /** Refresh token chỉ cần cho /auth/refresh-token và /auth/logout — thu hẹp bề mặt tấn công. */
    public static final String REFRESH_PATH = "/api/v1/auth";

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

    public List<String> readAccessTokens(HttpServletRequest request) {
        return readCookies(request, ACCESS_COOKIE);
    }

    public List<String> readRefreshTokens(HttpServletRequest request) {
        return readCookies(request, REFRESH_COOKIE);
    }

    /** Số cookie mang cùng một tên trong request — >1 nghĩa là đang có bản trùng cần dọn. */
    public long countCookies(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return 0;
        }
        return Arrays.stream(cookies).filter(c -> name.equals(c.getName())).count();
    }

    /**
     * Ghi một Set-Cookie đã hết hạn KHÔNG kèm Domain.
     *
     * Cookie không có Domain là host-only, nên lệnh xoá này chỉ chạm tới bản host-only trên đúng
     * host đang phục vụ request và không đụng tới bản mang Domain gốc mà hệ thống đang dùng —
     * hai cái đó là hai cookie khác nhau dù trùng tên.
     */
    public void expireHostOnlyCookie(HttpServletResponse response, String name, String path) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(name, "")
                .secure(cookieProperties.isSecure())
                .sameSite(cookieProperties.getSameSite())
                .path(path)
                .maxAge(Duration.ZERO)
                .build()
                .toString());
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
        return readCookies(request, name).stream().findFirst().orElse(null);
    }

    /**
     * Trả về MỌI giá trị của cookie tên {@code name}, không chỉ giá trị đầu tiên.
     *
     * Trình duyệt có thể giữ hai cookie trùng tên nhưng khác scope — một bản host-only do cấu hình
     * cũ ghi, một bản mang Domain gốc do cấu hình hiện tại ghi — và gửi cả hai trong cùng một
     * request. Thứ tự do trình duyệt quyết định, thường là bản cũ đứng trước, nên nếu chỉ lấy giá
     * trị đầu tiên thì ta khoá chết phiên của người dùng bằng một token đã hết hiệu lực.
     */
    private List<String> readCookies(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return List.of();
        }
        return Arrays.stream(cookies)
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(StringUtils::hasText)
                .toList();
    }
}
