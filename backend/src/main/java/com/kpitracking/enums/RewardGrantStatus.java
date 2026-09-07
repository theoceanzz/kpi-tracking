package com.kpitracking.enums;

/**
 * Vòng đời một đề nghị thưởng thủ công.
 *
 * <p>Không có DRAFT: giao diện thưởng là tạo-và-gửi luôn, một trạng thái không có
 * màn hình nào dùng tới chỉ làm phức tạp máy trạng thái.
 *
 * <p>Hạn mức đã dùng của ngân sách được suy ra từ tổng các đề nghị đang ở
 * {@link #PENDING_APPROVAL} và {@link #APPROVED}. Vì vậy chuyển sang
 * {@link #REJECTED}/{@link #CANCELLED}/{@link #REVOKED} tự trả lại hạn mức mà
 * không cần viết logic hoàn trả nào.
 */
public enum RewardGrantStatus {
    /** Vượt hạn mức hoặc vượt mức tối đa mỗi lần ⇒ chờ người có REWARD:APPROVE quyết. */
    PENDING_APPROVAL,
    /** Đã phát điểm (tự duyệt trong hạn mức, hoặc được cấp trên duyệt). */
    APPROVED,
    REJECTED,
    /** Người đề nghị tự huỷ khi còn đang chờ duyệt. */
    CANCELLED,
    /** Đã phát rồi nhưng bị thu hồi: mỗi người nhận có một giao dịch ADJUST âm bù trừ. */
    REVOKED
}
