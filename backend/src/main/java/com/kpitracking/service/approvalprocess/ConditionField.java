package com.kpitracking.service.approvalprocess;

import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiType;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * Trường so sánh được trong điều kiện duyệt. Mỗi trường nói rõ kiểu giá trị (để giao diện chọn ô
 * nhập phù hợp), các toán tử hợp lệ và đối tượng áp dụng. Giá trị so sánh luôn là hằng — không làm
 * kiểu so trường với trường.
 */
public enum ConditionField {
    /** Đơn vị của KPI. */
    ORG_UNIT(ValueType.ORG_UNIT, Ops.SET_WITH_SUBTREE, Applies.ALL, List.of()),
    /** Cấp đơn vị (OrgHierarchyLevel) của KPI. */
    ORG_LEVEL(ValueType.ORG_LEVEL, Ops.SET, Applies.ALL, List.of()),
    /** Người gửi duyệt. */
    REQUESTER(ValueType.USER, Ops.SET, Applies.ALL, List.of()),
    /** Chức vụ (vai trò) của người gửi, ở bất kỳ đơn vị nào trong tổ chức. */
    REQUESTER_ROLE(ValueType.ROLE, Ops.SET, Applies.ALL, List.of()),
    KPI_TYPE(ValueType.ENUM, Ops.SET, Applies.ALL, Arrays.stream(KpiType.values()).map(Enum::name).toList()),
    FREQUENCY(ValueType.ENUM, Ops.SET, Applies.ALL, Arrays.stream(KpiFrequency.values()).map(Enum::name).toList()),
    /** Kỳ KPI. */
    PERIOD(ValueType.PERIOD, Ops.SET, Applies.ALL, List.of()),
    /** Trọng số chỉ tiêu (%). */
    WEIGHT(ValueType.NUMBER, Ops.NUMBER, Applies.ALL, List.of()),
    IS_BONUS(ValueType.BOOLEAN, Ops.BOOL, Applies.ALL, List.of()),
    /** Loại yêu cầu điều chỉnh. */
    REQUEST_KIND(ValueType.ENUM, Ops.SET, Applies.ADJUSTMENT, List.of("CHANGE_TARGET", "DEACTIVATE")),
    /** Mức đổi chỉ tiêu so với hiện tại, tính theo % trị tuyệt đối. */
    TARGET_CHANGE_PERCENT(ValueType.NUMBER, Ops.NUMBER, Applies.ADJUSTMENT, List.of());

    public enum ValueType { ORG_UNIT, ORG_LEVEL, USER, ROLE, PERIOD, ENUM, NUMBER, BOOLEAN }

    private final ValueType valueType;
    private final List<ConditionOperator> operators;
    private final Set<ApprovalObjectType> objects;
    private final List<String> options;

    ConditionField(ValueType valueType, List<ConditionOperator> operators, Set<ApprovalObjectType> objects,
                   List<String> options) {
        this.valueType = valueType;
        this.operators = operators;
        this.objects = objects;
        this.options = options;
    }

    public ValueType valueType() {
        return valueType;
    }

    public List<ConditionOperator> operators() {
        return operators;
    }

    public boolean appliesTo(ApprovalObjectType objectType) {
        return objects.contains(objectType);
    }

    /** Các giá trị hợp lệ của trường kiểu ENUM; rỗng với kiểu khác. */
    public List<String> options() {
        return options;
    }

    private static final class Ops {
        static final List<ConditionOperator> SET = List.of(ConditionOperator.IN, ConditionOperator.NOT_IN);
        static final List<ConditionOperator> SET_WITH_SUBTREE =
                List.of(ConditionOperator.IN, ConditionOperator.NOT_IN, ConditionOperator.IN_SUBTREE);
        static final List<ConditionOperator> NUMBER = List.of(ConditionOperator.EQ, ConditionOperator.NEQ,
                ConditionOperator.GT, ConditionOperator.GTE, ConditionOperator.LT, ConditionOperator.LTE);
        static final List<ConditionOperator> BOOL = List.of(ConditionOperator.IS_TRUE, ConditionOperator.IS_FALSE);
    }

    private static final class Applies {
        static final Set<ApprovalObjectType> ALL = Set.of(ApprovalObjectType.values());
        static final Set<ApprovalObjectType> ADJUSTMENT = Set.of(ApprovalObjectType.KPI_ADJUSTMENT);
    }
}
