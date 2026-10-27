package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.service.evaluation.EvaluationService;
import com.kpitracking.service.kpi.CycleStatusGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** "Đánh giá và xếp loại hiệu suất": duyệt cuối ⇒ ghi đánh giá của quản lý như khi không có quy trình. */
@Component
@RequiredArgsConstructor
public class EvaluationApprovalHandler implements ApprovalSubjectHandler {

    private final EvaluationService evaluationService;
    private final KpiPeriodRepository periodRepository;
    private final CycleStatusGuard cycleStatusGuard;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.EVALUATION;
    }

    @Override
    public void guard(Map<String, Object> payload) {
        if (payload == null || payload.get("kpiPeriodId") == null) return;
        periodRepository.findById(UUID.fromString(String.valueOf(payload.get("kpiPeriodId"))))
                .ifPresent(cycleStatusGuard::assertWritable);
    }

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        evaluationService.applyApprovedEvaluation(flow.getPayload());
    }
}
