package com.kpitracking.enums;

/**
 * Cấp của một bộ tiêu chí trong cây BSC (xem docs/bsc-cascade-design.md — QĐ-1).
 *
 * <p>{@link #COMPANY} — bộ tiêu chí của cả công ty; KHÔNG gắn phòng ban nào (đây cũng chính là
 * "bộ tiêu chí mặc định toàn tổ chức" của mô hình cũ) và là gốc của cây nên không có cha.
 * <p>{@link #UNIT} — bộ tiêu chí của một/nhiều phòng ban; có thể trỏ lên bộ tiêu chí cha
 * (BSC công ty, hoặc BSC của đơn vị cấp trên với tổ chức nhiều tầng).
 *
 * <p>Cấp được SUY RA từ việc thẻ có gắn phòng ban hay không chứ không do client gửi lên,
 * nên không thể rơi vào trạng thái mâu thuẫn (xem {@code BscService.resolveLevel}).
 */
public enum BscScorecardLevel {
    COMPANY,
    UNIT
}
