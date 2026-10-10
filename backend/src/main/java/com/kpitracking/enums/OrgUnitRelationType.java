package com.kpitracking.enums;

/**
 * Quan hệ của một đơn vị với đơn vị cha — CHỈ để vẽ sơ đồ cơ cấu (V38). Mọi luật đi theo cây
 * (chuỗi duyệt, KpiAccessPolicy, quyền theo path, phân rã BSC/OKR…) vẫn theo {@code parent},
 * không đọc trường này.
 */
public enum OrgUnitRelationType {
    /** Trực tuyến: cấp trên chỉ đạo trực tiếp — nét liền. */
    DIRECT,
    /** Tham mưu – tư vấn — nét đứt. */
    ADVISORY,
    /** Giám sát độc lập — nét đứt. */
    SUPERVISORY;

    /** Đơn vị gốc không có cấp trên nên luôn là DIRECT; null (không gửi) cũng là DIRECT. */
    public static OrgUnitRelationType forUnit(boolean hasParent, OrgUnitRelationType requested) {
        return hasParent && requested != null ? requested : DIRECT;
    }
}
