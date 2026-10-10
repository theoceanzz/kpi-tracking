package com.kpitracking.service.discussion;

import com.kpitracking.entity.KpiApprovalFlow;
import com.kpitracking.entity.KpiApprovalStep;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.enums.ApprovalEventAction;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Dòng hệ thống trong khung thảo luận của KPI: gửi duyệt, duyệt từng bước, duyệt cuối, từ chối (kèm lý do), tự duyệt,
 * hoàn duyệt, thay thế, và các bước của chuỗi duyệt yêu cầu điều chỉnh (câu riêng "Yêu cầu điều chỉnh…").
 * Ghi trong CÙNG transaction với thao tác gốc.
 *
 * <p>Số chưa đọc chỉ tính dòng "từ chối", và chỉ cho người tạo KPI ({@code notifyUserId}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KpiDiscussionTimeline {

    private final DiscussionService discussionService;

    public void onApprovalEvent(KpiApprovalFlow flow, KpiApprovalStep step, ApprovalEventAction action, User actor,
                                String reason) {
        if (flow == null) return;
        KpiCriteria kpi = flow.getKpiCriteria();
        if (kpi == null) return;
        String actorName = actor != null ? actor.getFullName() : "";
        if (flow.getSubjectType() == ApprovalSubjectType.ADJUSTMENT) {
            onAdjustmentEvent(flow, kpi, step, action, actor, actorName, reason);
            return;
        }
        LocalizedText text;
        UUID notify = null;
        switch (action) {
            case SUBMITTED -> text = LocalizedText.of("discussion.system.submitted", actorName);
            case APPROVED_FORWARD -> text = LocalizedText.of("discussion.system.approvedForward", actorName,
                    step != null ? step.getStepOrder() : "");
            case APPROVED_FINAL -> text = LocalizedText.of("discussion.system.approvedFinal", actorName);
            case SELF_APPROVED_TOP -> text = LocalizedText.of("discussion.system.selfApproved", actorName);
            case REJECTED -> {
                text = LocalizedText.of("discussion.system.rejected", actorName, reason == null ? "" : reason);
                notify = kpi.getCreatedBy() != null ? kpi.getCreatedBy().getId() : null;
            }
            default -> {
                return;
            }
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("action", action.name());
        if (actor != null) meta.put("actorId", actor.getId().toString());
        if (step != null) meta.put("stepOrder", step.getStepOrder());
        if (reason != null) meta.put("reason", reason);
        post(kpi, text, meta, notify);
    }

    /**
     * Chuỗi duyệt YÊU CẦU ĐIỀU CHỈNH: câu luôn bắt đầu bằng "Yêu cầu điều chỉnh…" và mã hành động có tiền tố
     * {@code ADJ_} để không bị đọc nhầm là KPI bị từ chối. Không tính vào số chưa đọc.
     */
    private void onAdjustmentEvent(KpiApprovalFlow flow, KpiCriteria kpi, KpiApprovalStep step, ApprovalEventAction action,
                                   User actor, String actorName, String reason) {
        LocalizedText text;
        switch (action) {
            case SUBMITTED -> text = LocalizedText.of("discussion.system.adjSubmitted", actorName);
            case APPROVED_FORWARD -> text = LocalizedText.of("discussion.system.adjApprovedForward", actorName,
                    step != null ? step.getStepOrder() : "");
            case APPROVED_FINAL -> text = LocalizedText.of("discussion.system.adjApprovedFinal", actorName);
            case REJECTED -> text = LocalizedText.of("discussion.system.adjRejected", actorName, reason == null ? "" : reason);
            default -> {
                return;
            }
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("action", "ADJ_" + action.name());
        if (actor != null) meta.put("actorId", actor.getId().toString());
        if (step != null) meta.put("stepOrder", step.getStepOrder());
        if (flow.getAdjustmentRequest() != null) meta.put("adjustmentRequestId", flow.getAdjustmentRequest().getId().toString());
        if (reason != null) meta.put("reason", reason);
        post(kpi, text, meta, null);
    }

    public void onReverted(KpiCriteria kpi, User actor, String reason) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("action", "REVERTED");
        if (actor != null) meta.put("actorId", actor.getId().toString());
        post(kpi, LocalizedText.of("discussion.system.reverted", actor != null ? actor.getFullName() : "",
                reason == null ? "" : reason), meta, null);
    }

    /** KPI cũ chính thức bị thay: KPI cũ trỏ sang KPI mới và ngược lại; thảo luận cũ ở lại KPI cũ. */
    public void onReplaced(KpiCriteria oldKpi, KpiCriteria newKpi) {
        if (oldKpi == null || newKpi == null) return;
        Map<String, Object> toNew = new LinkedHashMap<>();
        toNew.put("action", "REPLACED_BY");
        toNew.put("linkedKpiId", newKpi.getId().toString());
        post(oldKpi, LocalizedText.of("discussion.system.replacedBy", newKpi.getName()), toNew, null);

        Map<String, Object> toOld = new LinkedHashMap<>();
        toOld.put("action", "REPLACES");
        toOld.put("linkedKpiId", oldKpi.getId().toString());
        post(newKpi, LocalizedText.of("discussion.system.replaces", oldKpi.getName()), toOld, null);
    }

    private void post(KpiCriteria kpi, LocalizedText text, Map<String, Object> meta, UUID notify) {
        discussionService.postSystem(DiscussionTargetType.KPI, kpi.getId(), KpiAccessPolicy.organizationIdOf(kpi),
                text, meta, notify);
    }
}
