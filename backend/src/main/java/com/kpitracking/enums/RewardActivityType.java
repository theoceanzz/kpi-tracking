package com.kpitracking.enums;

/**
 * Loại sự kiện xuất hiện trên bảng tin điểm thưởng — dải tin chạy ngang cho cả công ty
 * cùng thấy ai vừa được thưởng, ai được cấp hạn mức, ai vừa đổi quà.
 *
 * <p>CỐ Ý không có sự kiện điểm danh: mỗi người điểm danh mỗi ngày một lần, để vào đây
 * thì bảng tin chỉ còn là danh sách điểm danh và ba loại sự kiện đáng khoe bị đẩy đi mất.
 *
 * <p>Cũng không có "thu hồi điểm" hay "từ chối đổi quà". Bảng tin là chỗ ăn mừng; công
 * khai chuyện bị thu hồi trước cả công ty là bêu tên, không phải động viên.
 */
public enum RewardActivityType {
    /** Ai đó vừa được thưởng điểm — do sếp trao tay hoặc do chương trình tự động phát. */
    POINTS_AWARDED,
    /** Ai đó vừa được cấp hạn mức để đi thưởng người khác. */
    BUDGET_GRANTED,
    /** Ai đó vừa dùng điểm đổi quà. */
    GIFT_REDEEMED
}
