package com.kpitracking.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.io.IOException;
import java.time.Instant;

/**
 * Gắn {@code requestId} vào MỌI {@link ApiResponse} lỗi ({@code success=false}) trước khi serialize —
 * một chỗ duy nhất thay vì sửa từng handler trong GlobalExceptionHandler. Phản hồi thành công không
 * gắn (đã có header {@code X-Request-Id}). Không đổi 4 field cũ của ApiResponse.
 *
 * <p>Hai chỗ không đi qua Spring MVC (entry point 401 trong SecurityConfig, 429 của AuthRateLimitFilter)
 * dùng {@link #writeError} để có cùng hình dạng JSON.
 */
@RestControllerAdvice
public class RequestIdResponseAdvice implements ResponseBodyAdvice<Object> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .findAndRegisterModules()
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        if (body instanceof ApiResponse<?> api && !api.isSuccess() && api.getRequestId() == null) {
            api.setRequestId(MDC.get(MdcKeys.REQUEST_ID));
        }
        return body;
    }

    /** Ghi thẳng một ApiResponse lỗi ra servlet response (cho filter / entry point ngoài MVC). */
    public static void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiResponse<Void> body = ApiResponse.<Void>builder()
                .success(false)
                .message(message)
                .timestamp(Instant.now())
                .requestId(MDC.get(MdcKeys.REQUEST_ID))
                .build();
        MAPPER.writeValue(response.getWriter(), body);
    }
}
