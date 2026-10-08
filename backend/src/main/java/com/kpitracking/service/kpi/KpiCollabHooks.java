package com.kpitracking.service.kpi;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.service.discussion.KpiDiscussionTimeline;
import com.kpitracking.service.task.KpiTaskLifecycle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Điểm móc DUY NHẤT từ vòng đời KPI ({@code KpiCriteriaService}) sang thảo luận và công việc, để service KPI (đã rất
 * lớn) chỉ gọi một dòng. Chạy trong transaction của thao tác KPI.
 */
@Component
@RequiredArgsConstructor
public class KpiCollabHooks {

    private final KpiDiscussionTimeline timeline;
    private final KpiTaskLifecycle taskLifecycle;

    /** KPI cũ chính thức thành REPLACED. Thảo luận ở lại KPI cũ (có link qua lại); task: hỏi người dùng có chuyển không. */
    public void onReplaced(KpiCriteria oldKpi, KpiCriteria newKpi) {
        timeline.onReplaced(oldKpi, newKpi);
        taskLifecycle.onKpiReplaced(oldKpi, newKpi);
    }

    public void onApprovalReverted(KpiCriteria kpi, User actor) {
        timeline.onReverted(kpi, actor, null);
    }

    /** KPI bị xoá mềm: task giữ lại dạng "KPI đã xoá" (chụp tên KPI); thảo luận nằm yên cùng KPI. */
    public void onDeleted(KpiCriteria kpi) {
        taskLifecycle.onKpiDeleted(kpi);
    }
}
