package com.kpitracking.enums;

/**
 * Hệ quả khi một hạng mục chặn không đạt ngưỡng (docs/bsc-cascade-design.md — QĐ-7).
 *
 * <p>Cả ba đều tác động lên TRẦN XẾP LOẠI, không cái nào trừ điểm.
 *
 * <p>{@link #BLOCK_EXCELLENT} — không được mức cao nhất (trần = mức ngay dưới đỉnh thang).
 * <p>{@link #CAP_AT_RATING} — trần đúng bằng mức đã cấu hình.
 * <p>{@link #WARN_ONLY} — chỉ hiện cảnh báo, không hạ trần; dùng khi mới áp chính sách.
 */
public enum BscGateEffect {
    BLOCK_EXCELLENT,
    CAP_AT_RATING,
    WARN_ONLY
}
