package com.kpitracking.enums;

/**
 * Trạng thái đánh giá tổng hợp phòng ban theo kỳ.
 *
 * <pre>
 * DRAFT ──chốt dữ liệu kỳ──▶ CALIBRATING ──khoá kết quả──▶ FINALIZED
 *   ▲                            │   ▲                         │
 *   └──────── mở lại ────────────┘   └──────── mở khoá ────────┘
 * </pre>
 *
 * <ul>
 *   <li>{@code DRAFT}: các đợt trong kỳ còn đang đánh giá, số kỳ chỉ là tạm tính.</li>
 *   <li>{@code CALIBRATING}: ĐẦU VÀO đã đóng (đánh giá đợt và hạnh kiểm theo đợt không sửa được
 *       nữa) và điểm nền của từng người đã chụp lại; quản lý chấm điểm phòng, soi bell curve và
 *       hiệu chỉnh điểm kỳ cá nhân cho vừa khung. Điểm kỳ cá nhân — điểm chốt, mức định tính,
 *       hạnh kiểm cấp kỳ — VẪN chấm được.</li>
 *   <li>{@code FINALIZED}: đã khoá toàn bộ, con số đã công bố; cấp trên duyệt tiếp lên.</li>
 * </ul>
 */
public enum CycleUnitEvalStatus {
    DRAFT,
    CALIBRATING,
    FINALIZED;

    /** Đầu vào (đánh giá đợt, hạnh kiểm) đã đóng ở trạng thái này chưa. */
    public boolean inputsLocked() {
        return this != DRAFT;
    }
}
