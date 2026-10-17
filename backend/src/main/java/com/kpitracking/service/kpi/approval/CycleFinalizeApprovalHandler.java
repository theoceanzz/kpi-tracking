package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.repository.kpi.KpiCycleRepository;
import com.kpitracking.service.evaluation.KpiCycleEvaluationService;
import com.kpitracking.service.kpi.CycleStatusGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * "Chốt kỳ và công nhận kết quả": duyệt cuối ⇒ chốt kết quả đơn vị như khi không có quy trình; đơn
 * vị gốc thì khoá luôn kỳ trong cùng lần duyệt.
 */
@Component
@RequiredArgsConstructor
public class CycleFinalizeApprovalHandler implements ApprovalSubjectHandler {

    private final KpiCycleEvaluationService cycleEvaluationService;
    private final KpiCycleRepository cycleRepository;
    private final CycleStatusGuard cycleStatusGuard;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.CYCLE_FINALIZE;
    }

    @Override
    public void guard(Map<String, Object> payload) {
        if (payload == null || payload.get("cycleId") == null) return;
        cycleRepository.findById(UUID.fromString(String.valueOf(payload.get("cycleId"))))
                .ifPresent(cycleStatusGuard::assertWritable);
    }

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        cycleEvaluationService.applyApprovedFinalize(flow);
    }
}
