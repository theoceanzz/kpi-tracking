package com.kpitracking.event;

import java.util.List;
import java.util.UUID;

/**
 * Sự kiện của luồng BSC — vòng đời trình–duyệt của bộ tiêu chí, phân rã chỉ tiêu xuống đơn vị,
 * chốt kết quả của đợt và ghi đè điểm cá nhân. Listener nằm ở {@link BscNotificationEventListener}.
 *
 * <p><b>Chỉ mang ID, không mang entity.</b> Listener chạy {@code @Async} ở luồng khác và mở
 * transaction mới, nên entity truyền thẳng qua đã rời session: chạm vào bất kỳ liên kết lazy nào
 * (đơn vị áp dụng, chủ sở hữu, kỳ) là {@code LazyInitializationException}. Bên nhận tự nạp lại
 * từ repository — đắt thêm một truy vấn, đổi lấy việc không bao giờ nổ ở lớp gửi thông báo.
 */
public final class BscEvents {

    private BscEvents() {}

    /**
     * Đơn vị nhận một chỉ tiêu được giao xuống trong một lần phân rã.
     *
     * @param updated đơn vị ĐÃ nhận chỉ tiêu này từ trước, lần này chỉ đổi con số/vai trò — thông báo
     *                "đã cập nhật" thay vì "được giao mới" (sửa 3 lần không phải giao 3 chỉ tiêu)
     */
    public record CascadeAssignment(UUID orgUnitId,
                                    UUID childScorecardId,
                                    Double contributionValue,
                                    String unit,
                                    boolean updated) {}

    public record ScorecardSubmitted(UUID scorecardId, UUID actorId) {}

    public record ScorecardApproved(UUID scorecardId, UUID actorId) {}

    /**
     * Trả lại cho cấp dưới sửa.
     *
     * <p>{@code submitterId} phải chụp lại vào sự kiện chứ không đọc lại từ thẻ được:
     * {@code BscTreeService.reject} xoá {@code submittedBy} để thẻ quay về nháp sạch sẽ, nên tới
     * lúc listener chạy thì không còn ai để báo.
     */
    public record ScorecardRejected(UUID scorecardId, UUID submitterId, UUID actorId, String reason) {}

    public record ScorecardActivated(UUID scorecardId, UUID actorId) {}

    /** Một lần phân rã: MỘT chỉ tiêu của thẻ cha giao xuống nhiều đơn vị. */
    public record ScorecardCascaded(UUID parentScorecardId,
                                    UUID actorId,
                                    String itemName,
                                    List<CascadeAssignment> assignments) {}

    public record UnitResultFinalized(UUID scorecardId, UUID kpiPeriodId, UUID actorId) {}

    /** Cấp trên thu hồi MỘT chỉ tiêu đã phân rã khỏi bộ tiêu chí của một đơn vị. */
    public record CascadeRevoked(UUID orgUnitId, UUID childScorecardId, UUID actorId, String itemName) {}

    /** {@code cleared = true} là huỷ ghi đè, điểm quay về con số hệ thống tính. */
    public record EvaluationScoreOverridden(UUID evaluationId, UUID actorId, Double score, boolean cleared) {}
}
