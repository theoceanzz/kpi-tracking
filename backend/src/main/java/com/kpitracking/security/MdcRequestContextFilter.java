package com.kpitracking.security;

import com.kpitracking.logging.MdcKeys;
import com.kpitracking.security.audit.SecurityAuditService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Gắn correlation id + ngữ cảnh request vào MDC cho MỌI request HTTP.
 *
 * <p>Đăng ký NGOÀI chuỗi Spring Security, ngay sau {@link DuplicateAuthCookieFilter}, để 429 của
 * {@link AuthRateLimitFilter} và 401 của entry point cũng có {@code requestId}. {@code userId}/{@code orgId}
 * do {@link JwtAuthenticationFilter} bổ sung sau khi xác thực.
 *
 * <p>Với luồng SSE ({@code POST /ai/chat/stream}) filter chạy HAI lần trên cùng request (dispatch REQUEST
 * rồi ASYNC, trên thread khác) — vì thế {@code requestId} sinh một lần và cất vào request attribute; lần
 * sau chỉ nạp lại MDC. {@code finally MDC.clear()} là bắt buộc: Tomcat tái dùng thread, không dọn thì
 * request kế thừa nhầm ngữ cảnh của request trước.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class MdcRequestContextFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_ATTR = MdcRequestContextFilter.class.getName() + ".requestId";

    /** Chấp nhận id do client gửi để nối log qua nhiều dịch vụ, nhưng chỉ khi nó "sạch". */
    private static final Pattern SAFE_ID = Pattern.compile("^[A-Za-z0-9\\-]{8,64}$");

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String requestId = resolveRequestId(request);

        MDC.put(MdcKeys.REQUEST_ID, requestId);
        MDC.put(MdcKeys.IP, SecurityAuditService.clientIp(request));
        MDC.put(MdcKeys.METHOD, request.getMethod());
        MDC.put(MdcKeys.PATH, request.getRequestURI());

        // Đặt header TRƯỚC khi vào chain: response có thể bị commit sớm (SSE, lỗi ở filter sau).
        if (!response.isCommitted() && response.getHeader(MdcKeys.REQUEST_ID_HEADER) == null) {
            response.setHeader(MdcKeys.REQUEST_ID_HEADER, requestId);
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }

    /** Sinh đúng một lần cho mỗi request; dispatch ASYNC đọc lại từ attribute. */
    static String resolveRequestId(HttpServletRequest request) {
        Object existing = request.getAttribute(REQUEST_ID_ATTR);
        if (existing instanceof String s && !s.isEmpty()) {
            return s;
        }
        String fromClient = request.getHeader(MdcKeys.REQUEST_ID_HEADER);
        String id = fromClient != null && SAFE_ID.matcher(fromClient).matches()
                ? fromClient
                : UUID.randomUUID().toString();
        request.setAttribute(REQUEST_ID_ATTR, id);
        return id;
    }

    /** Chạy cả ở dispatch ASYNC, cùng lý do với JwtAuthenticationFilter. */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return false;
    }
}
