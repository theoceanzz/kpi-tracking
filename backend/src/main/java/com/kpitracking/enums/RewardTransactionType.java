package com.kpitracking.enums;

/**
 * Bản chất của một dòng trong sổ cái điểm thưởng.
 *
 * <p>Loại giao dịch quyết định ba cột tổng của ví được cập nhật thế nào — xem bảng
 * công thức trong {@code RewardWalletService}. Bất biến luôn phải đúng:
 * {@code balance = lifetime_earned - lifetime_spent - lifetime_expired}.
 */
public enum RewardTransactionType {
    /** Được thưởng (thủ công hoặc theo chương trình). Cộng balance và lifetime_earned. */
    EARN,
    /** Tiêu điểm để đổi quà. Trừ balance, cộng lifetime_spent. */
    SPEND,
    /**
     * Hoàn điểm khi yêu cầu đổi quà bị từ chối/huỷ. Cộng balance và TRỪ NGƯỢC
     * lifetime_spent — hoàn không phải là "được nhận thêm", nếu cộng vào
     * lifetime_earned thì người đặt rồi huỷ nhiều lần sẽ hiện đã nhận rất nhiều
     * điểm trong khi chưa từng được thưởng.
     */
    REFUND,
    /**
     * Điều chỉnh tay hoặc thu hồi thưởng. Dương thì như EARN; âm thì trừ balance
     * và TRỪ NGƯỢC lifetime_earned — khoản bị thu hồi coi như bị huỷ bỏ, không
     * phải "đã nhận rồi tiêu đi", nếu không bảng vinh danh sẽ đếm cả tiền đã rút lại.
     */
    ADJUST,
    /** Điểm hết hạn. Trừ balance, cộng lifetime_expired. Chưa dùng ở v1. */
    EXPIRE
}
