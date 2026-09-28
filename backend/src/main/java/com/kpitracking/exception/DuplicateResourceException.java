package com.kpitracking.exception;

import com.kpitracking.i18n.ErrorMessages;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Mã và cách dịch: xem {@link BusinessException}. */
@ResponseStatus(HttpStatus.CONFLICT)
public class DuplicateResourceException extends RuntimeException implements CodedException {

    private final ErrorCode errorCode;
    private final Object[] args;

    /** Cách cũ: câu hiển thị viết sẵn, không dịch được. */
    public DuplicateResourceException(String message) {
        super(message);
        this.errorCode = null;
        this.args = new Object[0];
    }

    public DuplicateResourceException(ErrorCode errorCode, Object... args) {
        super(errorCode.name());
        this.errorCode = errorCode;
        this.args = args.clone();
    }

    /** @param resource tên tài nguyên đã dịch được, vd. {@code Terms.of("resource.user")} */
    public DuplicateResourceException(MessageSourceResolvable resource, Object field, Object value) {
        this(ErrorCode.DUPLICATE_BY_FIELD, resource, field, String.valueOf(value));
    }

    /** Tên tài nguyên/trường là chuỗi thô (không dịch). */
    public DuplicateResourceException(String resourceName, String fieldName, Object value) {
        this(ErrorCode.DUPLICATE_BY_FIELD, resourceName, fieldName, String.valueOf(value));
    }

    @Override
    public String getMessage() {
        return errorCode != null ? ErrorMessages.resolve(errorCode, args) : super.getMessage();
    }

    @Override
    public ErrorCode getErrorCode() {
        return errorCode;
    }

    @Override
    public Object[] getArgs() {
        return args.clone();
    }
}
