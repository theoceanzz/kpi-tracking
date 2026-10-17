package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.service.reward.RewardRedemptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * "Duyệt đổi quà": duyệt cuối ⇒ yêu cầu sang ĐÃ DUYỆT, người giữ quà mới giao được; từ chối ở bước
 * nào ⇒ hoàn điểm, trả kho như "từ chối".
 */
@Component
@RequiredArgsConstructor
public class GiftRedemptionApprovalHandler implements ApprovalSubjectHandler {

    private final RewardRedemptionService redemptionService;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.GIFT_REDEMPTION;
    }

    @Override
    public void guard(Map<String, Object> payload) {}

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        redemptionService.approveByProcess(flow.getSubjectId(), actor);
    }

    @Override
    public void onRejected(KpiApprovalFlow flow, User actor, String reason) {
        redemptionService.rejectByProcess(flow.getSubjectId(), actor, reason);
    }
}
