package com.kpitracking.event;

import java.util.UUID;

/**
 * Sự kiện của chuỗi duyệt. Chỉ mang id: listener chạy SAU COMMIT trong transaction riêng và tự nạp
 * lại dữ liệu, nên không giữ thực thể đã tách khỏi phiên.
 */
public final class ApprovalChainEvents {

    private ApprovalChainEvents() {}

    /**
     * Một bước vừa tới lượt (sau khi gửi, sau khi cấp dưới duyệt, sau khi gán lại / tự chuyển lên)
     * hoặc đang được nhắc vì chờ quá hạn.
     */
    public record StepAssigned(UUID flowId, UUID stepId, Kind kind) {
        public enum Kind { NEW, FORWARDED, REASSIGNED, ESCALATED, REMINDER }
    }

    /**
     * Yêu cầu điều chỉnh đã có quyết định cuối (duyệt hoặc từ chối) — báo cho người xin. Chỉ tiêu
     * thì đã có {@code KpiCriteriaApprovedEvent} / {@code KpiCriteriaRejectedEvent} báo người tạo.
     */
    public record AdjustmentDecided(UUID flowId) {}

    /** Đề xuất theo quy trình (đánh giá đợt, chốt kỳ) đã được duyệt cuối hoặc bị từ chối — báo người gửi. */
    public record SubjectDecided(UUID flowId) {}

    /** Bước cuối không còn ai giữ (người duyệt bị vô hiệu hoá) — admin phải gán lại. */
    public record ReassignNeeded(UUID flowId, UUID stepId) {}

    /** Một yêu cầu vừa bắt đầu đi theo quy trình duyệt — báo người theo dõi quy trình. */
    public record ProcessFlowStarted(UUID flowId) {}

    /** Flow theo quy trình duyệt đã được duyệt cuối hoặc bị từ chối — báo người theo dõi. */
    public record ProcessFlowFinished(UUID flowId) {}
}
