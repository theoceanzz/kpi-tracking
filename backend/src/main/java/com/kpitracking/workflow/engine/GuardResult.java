package com.kpitracking.workflow.engine;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.ErrorMessages;

/**
 * Kết quả của một mắt xích trong chuỗi guard.
 *
 * <p>{@link Kind} tồn tại vì loại ngoại lệ là phần hợp đồng của API, không phải chi tiết nội bộ:
 * thiếu thẩm quyền phải ra {@code ForbiddenException} (403) còn vi phạm nghiệp vụ phải ra
 * {@code BusinessException} (422). Frontend và các test hiện có phân biệt đúng theo hai mã đó,
 * nên guard phải nói rõ mình từ chối vì lý do nào.
 *
 * <p>Lý do từ chối là {@link ErrorCode} + tham số để engine ném exception dịch được theo ngôn ngữ
 * người dùng; {@link #message()} chỉ là câu đã dịch để đọc/ghi log.
 */
public record GuardResult(boolean allowed, Kind kind, ErrorCode code, Object[] args) {

    public enum Kind { FORBIDDEN, BUSINESS }

    private static final GuardResult OK = new GuardResult(true, null, null, new Object[0]);

    public static GuardResult ok() {
        return OK;
    }

    /** Từ chối vì THẨM QUYỀN: người thao tác không được phép. */
    public static GuardResult forbidden(ErrorCode code, Object... args) {
        return new GuardResult(false, Kind.FORBIDDEN, code, args);
    }

    /** Từ chối vì NGHIỆP VỤ: được phép nhưng dữ liệu/trạng thái chưa cho đi tiếp. */
    public static GuardResult reject(ErrorCode code, Object... args) {
        return new GuardResult(false, Kind.BUSINESS, code, args);
    }

    public boolean denied() {
        return !allowed;
    }

    public String message() {
        return code == null ? null : ErrorMessages.resolve(code, args);
    }
}
