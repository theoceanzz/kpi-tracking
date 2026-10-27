package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.service.approvalform.ApprovalRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Đơn từ: duyệt bước cuối ⇒ đơn "Đã duyệt"; từ chối ở bước nào ⇒ đơn "Bị từ chối" kèm lý do. */
@Component
@RequiredArgsConstructor
public class FormRequestApprovalHandler implements ApprovalSubjectHandler {

    private final ApprovalRequestService requestService;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.FORM_REQUEST;
    }

    @Override
    public void guard(Map<String, Object> payload) {}

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        requestService.approveByProcess(flow.getSubjectId());
    }

    @Override
    public void onRejected(KpiApprovalFlow flow, User actor, String reason) {
        requestService.rejectByProcess(flow.getSubjectId(), reason);
    }
}
