package com.kpitracking.workflow.engine;

/**
 * Kết quả của một mắt xích trong chuỗi guard.
 *
 * <p>{@link Kind} tồn tại vì loại ngoại lệ là phần hợp đồng của API, không phải chi tiết nội bộ:
 * thiếu thẩm quyền phải ra {@code ForbiddenException} (403) còn vi phạm nghiệp vụ phải ra
 * {@code BusinessException} (422). Frontend và các test hiện có phân biệt đúng theo hai mã đó,
 * nên guard phải nói rõ mình từ chối vì lý do nào.
 */
public record GuardResult(boolean allowed, String message, GuardResult.Kind kind) {

    public enum Kind { FORBIDDEN, BUSINESS }

    private static final GuardResult OK = new GuardResult(true, null, null);

    public static GuardResult ok() {
        return OK;
    }

    /** Từ chối vì THẨM QUYỀN: người thao tác không được phép. */
    public static GuardResult forbidden(String message) {
        return new GuardResult(false, message, Kind.FORBIDDEN);
    }

    /** Từ chối vì NGHIỆP VỤ: được phép nhưng dữ liệu/trạng thái chưa cho đi tiếp. */
    public static GuardResult reject(String message) {
        return new GuardResult(false, message, Kind.BUSINESS);
    }

    public boolean denied() {
        return !allowed;
    }
}
