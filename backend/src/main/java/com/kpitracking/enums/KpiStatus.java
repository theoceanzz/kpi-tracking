package com.kpitracking.enums;

public enum KpiStatus {
    DRAFT,
    PENDING_APPROVAL,
    APPROVED,
    REJECTED,
    INACTIVE,
    EDIT,
    EDITED,
    REPLACED,
    /**
     * Không hoàn thành do khoá kỳ: KPI còn dở khi đợt bị "chốt tại hiện trạng". Không nhận thao
     * tác nào nữa; cách tính điểm (loại khỏi mẫu số hay tính 0) do
     * {@link com.kpitracking.service.KpiAchievementCalculator#CLOSED_BY_LOCK_SCORING} quyết định.
     */
    CLOSED_BY_LOCK
}
