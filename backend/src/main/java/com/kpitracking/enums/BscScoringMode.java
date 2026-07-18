package com.kpitracking.enums;

/**
 * Chế độ chấm điểm của một thẻ điểm BSC (đặt theo kỳ).
 * SHADOW   - điểm BSC được tính & lưu nhưng KHÔNG thay điểm hệ thống (chạy song song để đối chiếu).
 * OFFICIAL - điểm BSC là điểm chính thức, thay điểm hệ thống trong đánh giá.
 */
public enum BscScoringMode {
    SHADOW,
    OFFICIAL
}
