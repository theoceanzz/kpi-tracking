package com.kpitracking.enums;

/**
 * Trạng thái kết quả BSC của một đơn vị trong một đợt.
 *
 * <p>{@link #DRAFT} — tính lại được tự do.
 * <p>{@link #FINALIZED} — đã chốt: hệ số và dải đã chụp lại, dùng để tính điểm cá nhân.
 * <p>{@link #LOCKED} — đã khoá cùng kỳ; sửa dữ liệu nguồn không làm đổi kết quả đã công bố.
 */
public enum BscUnitResultStatus {
    DRAFT,
    FINALIZED,
    LOCKED
}
