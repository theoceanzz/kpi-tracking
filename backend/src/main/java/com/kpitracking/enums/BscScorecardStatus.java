package com.kpitracking.enums;

/**
 * Trạng thái của một thẻ điểm BSC (scorecard) theo kỳ.
 * DRAFT    - đang soạn, chưa áp dụng.
 * ACTIVE   - đang áp dụng cho kỳ.
 * ARCHIVED - đã lưu trữ (kỳ đã đóng).
 */
public enum BscScorecardStatus {
    DRAFT,
    ACTIVE,
    ARCHIVED
}
