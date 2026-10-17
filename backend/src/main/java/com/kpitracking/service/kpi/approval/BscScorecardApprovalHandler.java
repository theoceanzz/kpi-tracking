package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.KpiApprovalFlow;
import com.kpitracking.entity.User;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.service.BscTreeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * "Lập và phê duyệt thẻ điểm": duyệt cuối ⇒ thẻ áp dụng như duyệt tay; từ chối ở bước nào ⇒ trả về
 * nháp kèm lý do như "trả lại". Thẻ không gắn kỳ bị khoá nên không có gì phải gác trước.
 */
@Component
@RequiredArgsConstructor
public class BscScorecardApprovalHandler implements ApprovalSubjectHandler {

    private final BscTreeService treeService;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.BSC_SCORECARD;
    }

    @Override
    public void guard(Map<String, Object> payload) {}

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        treeService.applyApprovedByProcess(flow.getSubjectId(), actor);
    }

    @Override
    public void onRejected(KpiApprovalFlow flow, User actor, String reason) {
        treeService.applyRejectedByProcess(flow.getSubjectId(), actor, reason);
    }
}
