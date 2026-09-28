package com.kpitracking.i18n;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.LocaleResolver;

import java.io.IOException;

/**
 * Đặt {@link LocaleContextHolder} theo {@code Accept-Language} cho CẢ chuỗi filter, không chỉ phần
 * trong DispatcherServlet.
 *
 * <p>Không có filter này thì lỗi sinh ra trong filter bảo mật (401 của entry point, 429 của
 * {@code AuthRateLimitFilter}, 403 CSRF) sẽ dịch theo {@code request.getLocale()} mà
 * {@code RequestContextFilter} của Spring Boot đặt — giá trị đó lấy locale của JVM khi request không có
 * header, nên server cài tiếng Anh sẽ trả tiếng Anh cho người dùng Việt. Đăng ký ngay SAU
 * {@code RequestContextFilter} (xem {@code LocaleConfig}) để không bị nó ghi đè.
 */
public class LocaleContextFilter extends OncePerRequestFilter {

    private final LocaleResolver localeResolver;

    public LocaleContextFilter(LocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        LocaleContext previous = LocaleContextHolder.getLocaleContext();
        LocaleContextHolder.setLocale(localeResolver.resolveLocale(request));
        try {
            chain.doFilter(request, response);
        } finally {
            LocaleContextHolder.setLocaleContext(previous);
        }
    }
}
