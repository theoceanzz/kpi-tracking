package com.kpitracking.enums;

/**
 * Hệ số tra theo con số nào.
 *
 * <p>{@link #OVERALL} — BSC TỔNG của đơn vị/công ty (mặc định, đơn giản và dễ giải thích).
 * <p>{@link #LINKED_ITEM} — %đạt của chính chỉ tiêu cha mà KPI liên kết tới. Chuẩn hơn về nghiệp
 * vụ (BRD mục 17 #3: không áp điểm BSC tổng một cách máy móc cho KPI không liên quan) nhưng đòi
 * hỏi mọi KPI đều đã gắn đúng dòng BSC.
 */
public enum BscFactorBasis {
    OVERALL,
    LINKED_ITEM
}
