package com.kpitracking.workflow.def;

import com.kpitracking.workflow.WorkflowAction;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Bảng chuyển trạng thái của MỘT họ thực thể.
 *
 * <p>Vắng mặt một hành động ở đây là có ý nghĩa: nghĩa là tổ chức đã tắt bước chứa hành động đó,
 * nên gọi tới phải bị từ chối chứ không phải chạy im lặng.
 *
 * @param <S> kiểu enum trạng thái
 */
public final class StateMachine<S extends Enum<S>> {

    private final Map<WorkflowAction, Transition<S>> byAction;

    private StateMachine(Map<WorkflowAction, Transition<S>> byAction) {
        this.byAction = Collections.unmodifiableMap(byAction);
    }

    public static <S extends Enum<S>> StateMachine<S> of(List<Transition<S>> transitions) {
        Map<WorkflowAction, Transition<S>> map = new LinkedHashMap<>();
        for (Transition<S> t : transitions) {
            map.put(t.action(), t);
        }
        return new StateMachine<>(map);
    }

    public Optional<Transition<S>> find(WorkflowAction action) {
        return Optional.ofNullable(byAction.get(action));
    }

    public boolean supports(WorkflowAction action) {
        return byAction.containsKey(action);
    }

    public List<Transition<S>> transitions() {
        return List.copyOf(byAction.values());
    }
}
