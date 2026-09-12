package com.kpitracking.event;

import java.util.UUID;

/**
 * Sự kiện của luồng điểm thưởng — vòng đời đề nghị thưởng thủ công, hạn mức của người trao,
 * chương trình thưởng tự động và việc đổi điểm lấy quà.
 * Listener nằm ở {@link RewardNotificationEventListener}.
 *
 * <p><b>Chỉ mang ID, không mang entity</b> — cùng lý do đã ghi ở {@link BscEvents}: listener chạy
 * {@code @Async} ở luồng khác và mở transaction mới, nên entity truyền thẳng qua đã rời session và
 * chạm vào bất kỳ liên kết lazy nào ({@code grant.getGrantor()}, {@code redemption.getGiftItem()})
 * là {@code LazyInitializationException}. Bên nhận tự nạp lại từ repository.
 *
 * <p>Khác {@link WalletEvents} — lớp kia ra đời trước và mang thẳng entity. Không đổi nó theo vì
 * việc đó động vào đường tiền đang chạy; các sự kiện MỚI thì theo khuôn đúng ngay từ đầu.
 */
public final class RewardEvents {

    private RewardEvents() {}

    // ───────────────────────── Thưởng thủ công ─────────────────────────

    /** Đề nghị thưởng vượt hạn mức, đang chờ cấp trên duyệt. */
    public record GrantSubmitted(UUID grantId, UUID actorId) {}

    public record GrantApproved(UUID grantId, UUID actorId) {}

    public record GrantRejected(UUID grantId, UUID actorId, String note) {}

    /**
     * Điểm đã THỰC SỰ vào ví người nhận.
     *
     * <p>Tách khỏi {@link GrantApproved} vì hai việc này báo cho hai phía và không phải lúc nào
     * cũng đi cùng nhau: đề nghị nằm trong hạn mức phát điểm ngay mà không hề qua bước duyệt, nên
     * gắn thông báo của người nhận vào sự kiện "được duyệt" sẽ bỏ sót đúng nhánh phổ biến nhất.
     */
    public record GrantIssued(UUID grantId, UUID actorId) {}

    public record GrantRevoked(UUID grantId, UUID actorId, String note) {}

    /**
     * Người trao tự rút lại đề nghị khi nó còn đang chờ duyệt.
     *
     * <p>Người duyệt đã được báo là có việc; không báo tiếp thì đề nghị biến mất khỏi hàng đợi
     * của họ mà không có lời giải thích nào.
     */
    public record GrantCancelled(UUID grantId, UUID actorId) {}

    // ───────────────────────── Hạn mức ─────────────────────────

    /**
     * Một người được cấp hoặc được sửa hạn mức thưởng.
     *
     * <p>{@code updated = true} là sửa hạn mức có sẵn. Người trao cần phân biệt: "bạn vừa được cấp
     * hạn mức" và "hạn mức của bạn vừa đổi" dẫn tới hai hành động khác nhau.
     */
    public record BudgetAssigned(UUID budgetId, UUID actorId, boolean updated) {}

    // ───────────────────────── Chương trình thưởng ─────────────────────────

    /** {@code actorId} có thể null: bộ chạy nền tự phát thưởng khi đợt kết thúc. */
    public record RunIssued(UUID runId, UUID actorId) {}

    public record RunReverted(UUID runId, UUID actorId) {}

    // ───────────────────────── Đổi quà ─────────────────────────

    /** Có người vừa đặt đổi quà — hàng đợi của bộ phận xử lý quà có việc mới. */
    public record RedemptionCreated(UUID redemptionId) {}

    /**
     * Một yêu cầu đổi quà đã chốt trạng thái (duyệt, từ chối, đã giao, xuất quà hỏng, người đổi
     * tự huỷ). Listener đọc lại trạng thái đã lưu để soạn đúng câu, thay vì mỗi kết cục một
     * record — cả năm nhánh cùng người nhận, cùng dữ liệu, chỉ khác lời văn.
     */
    public record RedemptionSettled(UUID redemptionId, UUID actorId) {}
}
