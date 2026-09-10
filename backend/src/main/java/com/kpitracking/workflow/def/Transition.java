package com.kpitracking.workflow.def;

import com.kpitracking.workflow.WorkflowAction;

import java.util.Set;

/**
 * Một phép chuyển trạng thái, ở dạng DỮ LIỆU.
 *
 * <p>Trước refactor, mỗi phép chuyển là một bộ ba nằm lẫn trong thân service:
 * {@code if (status != X) throw} → {@code setStatus(Y)} → {@code publishEvent}. Rải trên hơn 3000
 * dòng của bốn service nên không đọc được toàn cảnh và không kiểm thử riêng được.
 *
 * @param <S> kiểu enum trạng thái của thực thể (KpiStatus / SubmissionStatus / AdjustmentStatus)
 */
public record Transition<S extends Enum<S>>(
        WorkflowAction action,
        Set<S> from,
        S to
) {
    public boolean accepts(S current) {
        return current != null && from.contains(current);
    }
}
