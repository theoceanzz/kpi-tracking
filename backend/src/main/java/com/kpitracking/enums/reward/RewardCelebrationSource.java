package com.kpitracking.enums.reward;

/** Nguồn của một lượt được ăn mừng — xem {@code RewardCelebrationService}. */
public enum RewardCelebrationSource {
    /** Thưởng tay (đề nghị thưởng đã duyệt + phát). {@code refId} = id đề nghị. */
    GRANT,
    /** Chương trình thưởng tự động đã phát. {@code refId} = id lần chạy. */
    PROGRAM_RUN,
    /** Đổi quà được người khác duyệt / giao. {@code refId} = id đơn đổi quà. */
    REDEMPTION
}
