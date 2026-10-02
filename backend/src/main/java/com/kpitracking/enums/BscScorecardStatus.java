package com.kpitracking.enums;

/**
 * Vòng đời của một bộ tiêu chí BSC (docs/bsc-cascade-design.md — mục 4.2).
 *
 * <p>DRAFT     - đang soạn, chưa trình.
 * <p>SUBMITTED - đã trình cấp trên chờ duyệt.
 * <p>APPROVED  - đã duyệt, chờ tới kỳ áp dụng.
 * <p>ACTIVE    - đang áp dụng cho kỳ.
 * <p>CLOSED    - kỳ đã đóng, không nhận cập nhật kết quả nữa.
 * <p>ARCHIVED  - trạng thái CŨ trước khi có vòng đời trình–duyệt. Giữ lại để dữ liệu đã tạo
 * không vỡ; ý nghĩa tương đương CLOSED. Không dùng cho bản ghi mới.
 */
public enum BscScorecardStatus {
    DRAFT,
    SUBMITTED,
    APPROVED,
    ACTIVE,
    CLOSED,
    ARCHIVED;

    /**
     * Thẻ đã THÔI DÙNG (đóng, hoặc lưu trữ kiểu cũ): không còn chấm điểm, không chiếm chỗ của đơn
     * vị/đợt khi tạo thẻ mới, và không được nhận nuôi lại khi phân rã.
     */
    public boolean isRetired() {
        return this == CLOSED || this == ARCHIVED;
    }
}
