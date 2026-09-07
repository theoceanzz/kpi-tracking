package com.kpitracking.enums;

/**
 * Cách một bộ tiêu chí BSC gắn với thời gian.
 *
 * <p>{@link #PERIOD} — chọn NHIỀU đợt cụ thể; bộ tiêu chí chỉ áp dụng đúng các đợt được chọn.
 * <p>{@link #CYCLE} — chọn MỘT kỳ đánh giá; bộ tiêu chí tự áp dụng cho MỌI đợt thuộc kỳ đó,
 * kể cả đợt được thêm vào kỳ sau này (không phải sửa lại bộ tiêu chí).
 */
public enum BscScorecardApplyScope {
    PERIOD,
    CYCLE
}
