package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.service.reward.RewardGrantService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/** "Đề xuất khen thưởng": duyệt cuối ⇒ phát điểm như duyệt tay; từ chối ở bước nào ⇒ như "từ chối". */
@Component
@RequiredArgsConstructor
public class RewardGrantApprovalHandler implements ApprovalSubjectHandler {

    private final RewardGrantService grantService;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.REWARD_GRANT;
    }

    @Override
    public void guard(Map<String, Object> payload) {}

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        grantService.approveByProcess(flow.getSubjectId(), actor);
    }

    @Override
    public void onRejected(KpiApprovalFlow flow, User actor, String reason) {
        grantService.rejectByProcess(flow.getSubjectId(), actor, reason);
    }
}
