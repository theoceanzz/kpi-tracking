package com.kpitracking.exception;

import com.kpitracking.i18n.ErrorMessages;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Mã và cách dịch: xem {@link BusinessException}. */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class ForbiddenException extends RuntimeException implements CodedException {

    private final ErrorCode errorCode;
    private final Object[] args;

    /** Cách cũ: câu hiển thị viết sẵn, không dịch được. */
    public ForbiddenException(String message) {
        super(message);
        this.errorCode = null;
        this.args = new Object[0];
    }

    public ForbiddenException(ErrorCode errorCode, Object... args) {
        super(errorCode.name());
        this.errorCode = errorCode;
        this.args = args.clone();
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
