package com.kpitracking.enums;

/**
 * Cách quy tỉ lệ đạt của một cấp (phòng/công ty) thành hệ số nhân vào điểm cá nhân
 * (docs/bsc-cascade-design.md — QĐ-4).
 *
 * <p>{@link #BAND_TABLE} — MẶC ĐỊNH: tra bảng dải để ra hệ số gần 1 (0.90–1.10).
 * <p>{@link #DIRECT_RATIO} — nhân thẳng tỉ lệ đạt (BSC/100), đúng chữ BRD 6.2. Là TUỲ CHỌN chứ
 * không phải mặc định: nhân thẳng phạt rất nặng (112 × 0.92 × 0.97 = 99.96) và lệch của phòng
 * lẫn công ty cộng dồn theo cấp số nhân.
 * <p>{@link #NONE} — bỏ hẳn tầng hệ số này (hệ số = 1).
 */
public enum BscFactorMode {
    BAND_TABLE,
    DIRECT_RATIO,
    NONE
}
