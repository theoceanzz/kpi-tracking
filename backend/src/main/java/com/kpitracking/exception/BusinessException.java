package com.kpitracking.exception;

import com.kpitracking.i18n.ErrorMessages;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Vi phạm luật nghiệp vụ.
 *
 * <p>Code mới dùng {@link #BusinessException(ErrorCode, Object...)}: {@code GlobalExceptionHandler} dịch
 * {@code error.<MÃ>} theo ngôn ngữ của người gọi và trả đúng HTTP status của mã. Constructor nhận câu
 * tiếng Việt là cách cũ, chỉ còn cho câu dựng động không tách được thành mẫu; lỗi đó có mã
 * {@link ErrorCode#BUSINESS_RULE} và câu được trả nguyên văn.
 *
 * <p>{@link #getMessage()} trả câu đã dịch theo ngôn ngữ của request hiện tại (tiếng Việt nếu ngoài
 * request), vì nhiều chỗ bắt exception rồi dùng lại câu đó (gom lỗi import, trả cho trợ lý AI).
 *
 * <p>Test assert theo {@link #getErrorCode()}, không theo {@link #getMessage()}: sửa câu dịch không được
 * làm đỏ test.
 */
@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
public class BusinessException extends RuntimeException implements CodedException {

    private static final Object[] NO_ARGS = new Object[0];

    private final ErrorCode errorCode;
    private final Object[] args;

    /** Cách cũ: câu hiển thị viết sẵn, không dịch được. */
    public BusinessException(String message) {
        super(message);
        this.errorCode = null;
        this.args = NO_ARGS;
    }

    /**
     * @param args tham số chèn vào {0}, {1}... của câu dịch. Truyền dữ liệu người dùng (tên KPI, tên
     *             người) nguyên văn; đừng truyền câu tiếng Việt dựng sẵn.
     */
    public BusinessException(ErrorCode errorCode, Object... args) {
        super(errorCode.name());
        this.errorCode = errorCode;
        this.args = args.clone();
    }

    @Override
    public String getMessage() {
        return errorCode != null ? ErrorMessages.resolve(errorCode, args) : super.getMessage();
    }

    /** Null nếu tạo bằng constructor cũ. */
    @Override
    public ErrorCode getErrorCode() {
        return errorCode;
    }

    @Override
    public Object[] getArgs() {
        return args.clone();
    }
}
