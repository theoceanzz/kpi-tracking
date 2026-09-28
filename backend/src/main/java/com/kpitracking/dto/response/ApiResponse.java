package com.kpitracking.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    /**
     * Mã lỗi ổn định ({@code ErrorCode}), chỉ có ở phản hồi lỗi. Frontend dùng mã cho logic, còn câu hiển
     * thị lấy nguyên văn từ {@link #message} (backend đã dịch theo {@code Accept-Language}).
     */
    private String code;
    private String message;
    private T data;
    private Instant timestamp;
    /**
     * Mã tra cứu (= header X-Request-Id = MDC requestId trong log). Chỉ gắn vào phản hồi lỗi
     * (RequestIdResponseAdvice) để người dùng báo CSKH kèm mã; null thì Jackson bỏ qua field.
     */
    private String requestId;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .timestamp(Instant.now())
                .build();
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .timestamp(Instant.now())
                .build();
    }

    public static <T> ApiResponse<T> success(String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .timestamp(Instant.now())
                .build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .timestamp(Instant.now())
                .build();
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .code(code)
                .message(message)
                .timestamp(Instant.now())
                .build();
    }
}
