package com.kpitracking.workflow.guard;

import com.kpitracking.workflow.engine.GuardResult;
import com.kpitracking.workflow.engine.TransitionContext;

/**
 * Một mắt xích trong chuỗi kiểm trước khi cho phép chuyển trạng thái (Chain of Responsibility).
 *
 * <p>Chuỗi này tồn tại để tách ba mối quan tâm mà code cũ trộn chung trong một khối {@code if}:
 * điều kiện TRẠNG THÁI, THẨM QUYỀN của người thao tác, và ràng buộc NGHIỆP VỤ (tổng trọng số 100%,
 * viễn cảnh BSC, hạn nộp). Trộn chung nên không kiểm thử riêng được mảnh nào, và khối luật cấp bậc
 * bị chép nguyên văn năm lần vì không có chỗ nào để đặt nó cho tử tế.
 *
 * <p>Guard KHÔNG được sửa dữ liệu — chỉ phán xét. Việc ghi do service làm sau khi cả chuỗi thông.
 */
@FunctionalInterface
public interface TransitionGuard {

    GuardResult check(TransitionContext<?> ctx);

    default String guardName() {
        return getClass().getSimpleName();
    }
}
