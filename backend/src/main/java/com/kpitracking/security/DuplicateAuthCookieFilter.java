package com.kpitracking.security;

import com.kpitracking.config.CookieProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Xoá các cookie xác thực host-only còn sót lại từ cấu hình cũ.
 *
 * Khi app chuyển sang cấp cookie kèm Domain gốc (keygo.vn), những cookie host-only mà trình duyệt
 * đã lưu trước đó không tự mất: chúng trùng tên với cookie mới nhưng là cookie khác, và trình duyệt
 * gửi kèm CẢ HAI trong cùng một request. Hậu quả:
 *
 *  - server đọc kg_at/kg_rt trúng bản cũ đã hết hiệu lực;
 *  - axios đọc document.cookie ở keygo.vn trúng bản kg_csrf do handshake /ws cấp, khác với bản mà
 *    api.keygo.vn đang giữ, nên mọi POST/PUT/PATCH/DELETE bị CsrfFilter chặn.
 *
 * Phía đọc đã được làm cho chịu được trùng lặp, nhưng trạng thái vẫn cần hội tụ về đúng một cookie.
 * Filter này phát lệnh xoá bản host-only ngay khi phát hiện có từ hai cookie cùng tên trở lên.
 *
 * Chạy ở HIGHEST_PRECEDENCE để đứng trước chuỗi filter của Spring Security (order -100): CsrfFilter
 * có thể từ chối request và commit response, lúc đó filter đặt sau sẽ không bao giờ chạy tới —
 * đúng vào trường hợp hỏng mà ta cần dọn.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class DuplicateAuthCookieFilter extends OncePerRequestFilter {

    private final CookieProperties cookieProperties;
    private final AuthCookieService authCookieService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        // Domain rỗng = cookie vốn đã là host-only (dev, hoặc triển khai một host duy nhất).
        // Khi đó không có bản trùng nào để dọn và lệnh xoá sẽ giết nhầm cookie đang dùng.
        if (StringUtils.hasText(cookieProperties.getDomain())) {
            expireHostOnlyDuplicate(request, response,
                    AuthCookieService.ACCESS_COOKIE, AuthCookieService.ACCESS_PATH);
            expireHostOnlyDuplicate(request, response,
                    AuthCookieService.REFRESH_COOKIE, AuthCookieService.REFRESH_PATH);
            expireHostOnlyDuplicate(request, response,
                    AuthCookieService.CSRF_COOKIE, AuthCookieService.ACCESS_PATH);
        }

        filterChain.doFilter(request, response);
    }

    private void expireHostOnlyDuplicate(HttpServletRequest request, HttpServletResponse response,
                                         String name, String path) {
        if (authCookieService.countCookies(request, name) > 1) {
            authCookieService.expireHostOnlyCookie(response, name, path);
        }
    }
}
