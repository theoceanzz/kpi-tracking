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
            putUserIntoMdc(userDetails);
            return true;
        } catch (Exception e) {
            log.debug("Bỏ qua một access token không dùng được: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Bổ sung ngữ cảnh người dùng vào MDC (requestId/ip đã do MdcRequestContextFilter đặt).
     * MdcRequestContextFilter clear MDC ở finally nên không cần dọn ở đây.
     */
    static void putUserIntoMdc(UserDetails userDetails) {
        org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.USER, userDetails.getUsername());
        if (userDetails instanceof AppUserPrincipal p) {
            if (p.getUserId() != null) {
                org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.USER_ID, p.getUserId().toString());
            }
            if (p.getOrganizationId() != null) {
                org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.ORG_ID, p.getOrganizationId().toString());
            }
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

        // Có header Authorization thì CHỈ tin header, bỏ qua cookie. SecurityConfig miễn CSRF cho
        // request mang Bearer với lập luận "trình duyệt không tự gắn header này" — lập luận đó chỉ
        // đúng khi phiên cũng đến từ header. Nếu vẫn đọc cookie ở đây, một request mang
        // "Authorization: Bearer rác" + cookie hợp lệ sẽ vừa được miễn CSRF vừa được xác thực.
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            tokens.add(normalize(authHeader.substring(7)));
            return tokens;
        }

        for (String fromCookie : authCookieService.readAccessTokens(request)) {
            tokens.add(normalize(fromCookie));
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

    /**
     * Xác thực LẠI ở dispatch ASYNC (mặc định của {@link OncePerRequestFilter} là bỏ qua).
     *
     * <p>Cần cho các endpoint trả {@code SseEmitter} (hiện là {@code POST /ai/chat/stream}): khi lượt
     * bất đồng bộ kết thúc, Tomcat chạy LẠI chuỗi filter một lần nữa ở dispatch ASYNC. Bỏ qua ở đây
     * thì lần chạy đó không có ai xác thực, {@code AuthorizationFilter} coi là ẩn danh và ném
     * {@code AccessDeniedException} — nhưng phản hồi đã gửi đi rồi nên Spring Security không xử lý
     * được, kết cục là Tomcat cắt phăng kết nối và client thấy "terminated" giữa chừng.
     *
     * <p>Chọn cách này thay vì gỡ ASYNC khỏi chuỗi filter bảo mật: phép kiểm quyền vẫn chạy đủ ở cả
     * hai lần dispatch. Giá phải trả là một lần đọc người dùng nữa cho mỗi lượt streaming.
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
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
