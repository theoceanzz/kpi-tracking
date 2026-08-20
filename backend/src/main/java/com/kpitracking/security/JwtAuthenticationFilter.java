package com.kpitracking.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final AuthCookieService authCookieService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            for (String jwt : resolveTokens(request)) {
                if (authenticate(jwt, request)) {
                    break;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    /** @return true nếu token này hợp lệ và đã được đặt vào SecurityContext. */
    private boolean authenticate(String jwt, HttpServletRequest request) {
        try {
            String email = jwtTokenProvider.extractEmail(jwt);
            if (!StringUtils.hasText(email)) {
                return false;
            }

            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            if (!jwtTokenProvider.isTokenValid(jwt, userDetails)) {
                return false;
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());

            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
            return true;
        } catch (Exception e) {
            log.debug("Bỏ qua một access token không dùng được: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Ưu tiên cookie HttpOnly (luồng chính của trình duyệt); header Authorization giữ lại
     * để Swagger, Postman và các client không phải trình duyệt vẫn dùng được.
     *
     * Trả về danh sách chứ không phải một giá trị: trình duyệt có thể gửi nhiều cookie kg_at
     * trùng tên khác scope, và cái đứng đầu thường là bản cũ đã hết hạn. Thử lần lượt cho tới khi
     * gặp token hợp lệ, thay vì để một cookie thừa khoá chết phiên đăng nhập.
     */
    private List<String> resolveTokens(HttpServletRequest request) {
        List<String> tokens = new ArrayList<>();

        for (String fromCookie : authCookieService.readAccessTokens(request)) {
            tokens.add(normalize(fromCookie));
        }

        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            tokens.add(normalize(authHeader.substring(7)));
        }

        return tokens;
    }

    private String normalize(String token) {
        String jwt = token.trim();

        if (jwt.startsWith("Bearer ")) {
            jwt = jwt.substring(7).trim();
        }

        return jwt.replaceAll("\\s+", "");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/api/v1/auth/login") ||
               path.equals("/api/v1/auth/register") ||
               path.equals("/api/v1/auth/refresh-token") ||
               path.equals("/api/v1/auth/forgot-password") ||
               path.equals("/api/v1/auth/reset-password") ||
               path.equals("/api/v1/auth/verify-email") ||
               path.equals("/api/v1/auth/resend-verification") ||
               path.startsWith("/api/v1/auth/lark/") ||
               path.startsWith("/api/v1/public/") ||
               path.startsWith("/swagger-ui") ||
               path.startsWith("/v3/api-docs");
    }
}
