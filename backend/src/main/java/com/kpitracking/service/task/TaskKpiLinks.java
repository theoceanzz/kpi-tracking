package com.kpitracking.service.task;

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.service.kpi.CycleStatusGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * MỘT chỗ phân biệt ba trạng thái KPI của một việc (docs/TASKS_DESIGN.md §1):
 * <ul>
 *   <li>{@link State#NONE} — không gắn KPI ({@code kpi_criteria_id IS NULL}): không khoá kỳ, không ràng buộc người thực hiện;</li>
 *   <li>{@link State#DELETED} — có id nhưng KPI đã xoá mềm: CHỈ ĐỌC, chỉ chuyển KPI khác hoặc xoá, không gỡ KPI được;</li>
 *   <li>{@link State#ACTIVE} — KPI còn: luật cũ, mọi lần ghi qua {@link CycleStatusGuard}.</li>
 * </ul>
 * Code cũ hiểu "không tìm thấy KPI" là "KPI đã xoá" — với KPI tuỳ chọn điều đó sai (và {@code findById(null)} ném lỗi),
 * nên mọi chỗ phải hỏi qua đây thay vì tự kiểm null.
 */
@Component
@RequiredArgsConstructor
public class TaskKpiLinks {

    public enum State { NONE, DELETED, ACTIVE }

    public record Link(State state, UUID kpiId, KpiCriteria kpi) {

        public static final Link NONE = new Link(State.NONE, null, null);

        public boolean none() { return state == State.NONE; }

        public boolean deleted() { return state == State.DELETED; }

        public boolean active() { return state == State.ACTIVE; }
    }

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final CycleStatusGuard cycleStatusGuard;

    public Link of(KpiTask task) {
        return ofKpiId(task.getKpiCriteriaId());
    }

    public Link ofKpiId(UUID kpiId) {
        if (kpiId == null) return Link.NONE;
        return kpiCriteriaRepository.findById(kpiId)
                .map(k -> new Link(State.ACTIVE, kpiId, k))
                .orElseGet(() -> new Link(State.DELETED, kpiId, null));
    }

    /** Một lượt truy vấn cho cả trang. */
    public Map<UUID, Link> ofAll(Collection<KpiTask> tasks) {
        Set<UUID> ids = tasks.stream().map(KpiTask::getKpiCriteriaId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, KpiCriteria> kpis = ids.isEmpty() ? Map.of() : kpiCriteriaRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(KpiCriteria::getId, Function.identity()));
        Map<UUID, Link> out = new HashMap<>();
        for (KpiTask t : tasks) {
            UUID k = t.getKpiCriteriaId();
            out.put(t.getId(), k == null ? Link.NONE
                    : kpis.containsKey(k) ? new Link(State.ACTIVE, k, kpis.get(k)) : new Link(State.DELETED, k, null));
        }
        return out;
    }

    /**
     * Chốt trước MỌI lần ghi lên việc: KPI còn ⇒ kỳ chưa khoá ({@code FOR SHARE}, an toàn với khoá kỳ); KPI đã xoá ⇒ chỉ
     * đọc (trừ khi {@code allowDeleted} — chuyển KPI / xoá việc); không KPI ⇒ ghi tự do.
     */
    public Link assertWritable(KpiTask task, boolean allowDeleted) {
        Link link = of(task);
        switch (link.state()) {
            case ACTIVE -> cycleStatusGuard.assertWritable(link.kpi());
            case DELETED -> { if (!allowDeleted) throw new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY); }
            case NONE -> { }
        }
        return link;
    }
}
