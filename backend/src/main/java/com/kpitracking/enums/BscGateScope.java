package com.kpitracking.enums;

/**
 * Hạng mục chặn áp cho ai. Chọn theo TỪNG dòng chỉ tiêu, không phải một cấu hình toàn cục:
 * "An toàn lao động" có thể chặn cả phòng, trong khi "Chứng chỉ nghiệp vụ" chỉ chặn cá nhân.
 */
public enum BscGateScope {
    INDIVIDUAL,
    UNIT,
    BOTH
}
