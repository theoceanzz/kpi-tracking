package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.service.bsc.BscCascadeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * "Chốt kết quả thẻ điểm đơn vị": duyệt cuối ⇒ chốt như bấm "Chốt" khi không có quy trình (kiểm lại
 * thẻ nguồn theo số lúc này). Từ chối thì kết quả vẫn ở nháp, người gửi được báo kèm lý do.
 */
@Component
@RequiredArgsConstructor
public class BscResultApprovalHandler implements ApprovalSubjectHandler {

    private final BscCascadeService cascadeService;

    @Override
    public ApprovalSubjectType type() {
        return ApprovalSubjectType.BSC_RESULT;
    }

    @Override
    public void guard(Map<String, Object> payload) {}

    @Override
    public void apply(KpiApprovalFlow flow, User actor) {
        cascadeService.applyApprovedFinalize(flow.getPayload(), flow.getRequester());
    }
}
