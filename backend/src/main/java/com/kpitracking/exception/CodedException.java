package com.kpitracking.exception;

/**
 * Exception mang {@link ErrorCode}: {@code GlobalExceptionHandler} trả mã đó cùng câu đã dịch theo
 * {@code Accept-Language}. {@link #getErrorCode()} null nghĩa là exception tạo bằng constructor cũ (câu
 * tiếng Việt viết sẵn), khi đó câu được trả nguyên văn.
 */
public interface CodedException {

    ErrorCode getErrorCode();

    Object[] getArgs();
}
