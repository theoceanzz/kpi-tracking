package com.kpitracking.enums;

/**
 * Nguồn gốc của một dòng chỉ tiêu BSC hoặc một KPI cá nhân (docs/bsc-cascade-design.md — QĐ-3).
 *
 * <p>{@link #ASSIGNED} — do cấp trên phân rã xuống. Cấp dưới không sửa được mục tiêu/trọng số,
 * chỉ gắn con và cập nhật kết quả.
 * <p>{@link #SELF} — do chính cấp đó tự thêm. Sửa thoải mái khi chưa duyệt.
 *
 * <p>Tỉ lệ giữa hai loại này chính là thứ phân biệt ba kịch bản giao việc: giao đủ (100%
 * ASSIGNED), giao phần quan trọng rồi cấp dưới bổ sung (mix), cấp dưới tự tạo cả (0% ASSIGNED).
 * Không có "chế độ" nào phải cấu hình — mỗi phòng, mỗi nhân viên có thể ở một kịch bản khác nhau
 * trong cùng một kỳ.
 */
public enum BscItemOrigin {
    ASSIGNED,
    SELF
}
