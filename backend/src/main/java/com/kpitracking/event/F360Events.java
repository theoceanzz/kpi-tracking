package com.kpitracking.event;

import java.util.List;
import java.util.UUID;

/**
 * Sự kiện của đánh giá 360. Chỉ mang id: listener chạy SAU commit trong transaction riêng và tự
 * nạp lại dữ liệu, không giữ entity của transaction đã đóng.
 */
public final class F360Events {

    private F360Events() {}

    /** Người chấm được mời (chiến dịch khởi động, hoặc HR thêm người khi đang mở). */
    public record RatersInvitedEvent(UUID campaignId, List<UUID> assignmentIds) {}

    /** HR mở lại một phiếu đã nộp — báo cho chính người chấm, kèm lý do. */
    public record AssignmentReopenedEvent(UUID assignmentId, String reason) {}

    /** Nhắc thủ công các phiếu còn dở. */
    public record RatersRemindedEvent(UUID campaignId, List<UUID> assignmentIds) {}

    /** Báo cáo đã công bố cho người được đánh giá. */
    public record ReportReleasedEvent(UUID campaignId) {}

    /** Chiến dịch vào giai đoạn đề cử — mời người được đánh giá đề cử thêm người chấm. */
    public record NominationOpenedEvent(UUID campaignId) {}

    /** Người được đánh giá đã gửi đề cử — báo người duyệt. */
    public record NominationSubmittedEvent(UUID subjectId) {}

    /** Người chấm từ chối phiếu — báo người duyệt và người tạo chiến dịch để thay người. */
    public record AssignmentDeclinedEvent(UUID assignmentId) {}

    /**
     * Cần (tạo lại) tóm tắt AI: cả chiến dịch khi đóng ({@code subjectId} null), hoặc một người sau
     * khi ẩn nhận xét / HR bấm "Tạo lại". {@code actorEmail} để ghi tiêu thụ token đúng người (listener
     * chạy bất đồng bộ, không còn SecurityContext); null = người tạo chiến dịch.
     */
    public record SummaryRequestedEvent(UUID campaignId, UUID subjectId, String actorEmail) {}
}
