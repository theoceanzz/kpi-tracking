package com.kpitracking.enums;

import java.util.List;

/**
 * Đối tượng mà một quy trình duyệt áp dụng ("Đối tượng" trên màn 1Office), kèm các đối tượng con.
 * Chỉ những đối tượng đã đi qua chuỗi duyệt ({@link ApprovalSubjectType}) mới có ở đây — quy trình
 * của đối tượng khác sẽ không có tác dụng gì nên không cho chọn.
 */
public enum ApprovalObjectType {
    /** Giao KPI: đối tượng con theo loại chỉ tiêu ({@link KpiType}). */
    KPI_CRITERIA("KPI", ApprovalSubjectType.CRITERIA, List.of("QUANTITATIVE", "QUALITATIVE")),
    /** Yêu cầu điều chỉnh KPI: đổi chỉ tiêu, hoặc xin dừng KPI. */
    KPI_ADJUSTMENT("KPI", ApprovalSubjectType.ADJUSTMENT, List.of("CHANGE_TARGET", "DEACTIVATE"));

    private final String group;
    private final ApprovalSubjectType subjectType;
    private final List<String> subObjects;

    ApprovalObjectType(String group, ApprovalSubjectType subjectType, List<String> subObjects) {
        this.group = group;
        this.subjectType = subjectType;
        this.subObjects = subObjects;
    }

    public String group() {
        return group;
    }

    public ApprovalSubjectType subjectType() {
        return subjectType;
    }

    public List<String> subObjects() {
        return subObjects;
    }

    public static ApprovalObjectType of(ApprovalSubjectType subjectType) {
        for (ApprovalObjectType t : values()) {
            if (t.subjectType == subjectType) return t;
        }
        throw new IllegalArgumentException("No approval object for " + subjectType);
    }
}
