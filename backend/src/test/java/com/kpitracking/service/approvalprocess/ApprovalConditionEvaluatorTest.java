package com.kpitracking.service.approvalprocess;

import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ProcessGraph.ConditionGroup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.kpitracking.service.approvalprocess.Graphs.rule;
import static org.assertj.core.api.Assertions.assertThat;

class ApprovalConditionEvaluatorTest {

    private final UUID unitA = UUID.randomUUID();
    private final UUID unitB = UUID.randomUUID();
    private final UUID root = UUID.randomUUID();
    private final UUID requester = UUID.randomUUID();
    private final UUID roleStaff = UUID.randomUUID();

    private ApprovalSubjectFacts facts(String kpiType, Double weight, boolean bonus) {
        return new ApprovalSubjectFacts(ApprovalObjectType.KPI_CRITERIA, kpiType, unitA,
                new LinkedHashSet<>(List.of(unitA, unitB, root)), UUID.randomUUID(), requester, Set.of(roleStaff),
                kpiType, "MONTHLY", null, weight, bonus, null, null, null, Map.of());
    }

    @Test
    @DisplayName("Trong nhóm là VÀ, giữa các nhóm là HOẶC")
    void andWithinOrBetween() {
        var qualitative = rule(ConditionField.KPI_TYPE, ConditionOperator.IN, "QUALITATIVE");
        var heavy = rule(ConditionField.WEIGHT, ConditionOperator.GTE, "30");
        var bonus = rule(ConditionField.IS_BONUS, ConditionOperator.IS_TRUE);
        List<ConditionGroup> groups = List.of(new ConditionGroup(List.of(qualitative, heavy)),
                new ConditionGroup(List.of(bonus)));

        assertThat(ApprovalConditionEvaluator.matches(groups, facts("QUALITATIVE", 30d, false))).isTrue();
        assertThat(ApprovalConditionEvaluator.matches(groups, facts("QUALITATIVE", 10d, false))).isFalse();
        assertThat(ApprovalConditionEvaluator.matches(groups, facts("QUANTITATIVE", 10d, true))).isTrue();
    }

    @Test
    @DisplayName("Đơn vị: 'thuộc' chỉ khớp đúng đơn vị, 'kể cả đơn vị con' khớp khi chọn cấp cha")
    void orgUnitOperators() {
        var f = facts("QUANTITATIVE", 10d, false);
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.ORG_UNIT, ConditionOperator.IN, unitB.toString()), f)).isFalse();
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.ORG_UNIT, ConditionOperator.IN_SUBTREE, unitB.toString()), f)).isTrue();
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.ORG_UNIT, ConditionOperator.NOT_IN, unitB.toString()), f)).isTrue();
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.REQUESTER_ROLE, ConditionOperator.IN, roleStaff.toString()), f)).isTrue();
    }

    @Test
    @DisplayName("Thiếu giá trị số thì mọi phép so sánh đều sai, kể cả 'khác'")
    void missingNumberNeverMatches() {
        var f = facts("QUALITATIVE", null, false);
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.WEIGHT, ConditionOperator.NEQ, "5"), f)).isFalse();
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.WEIGHT, ConditionOperator.LT, "5"), f)).isFalse();
        assertThat(ApprovalConditionEvaluator.test(rule(ConditionField.WEIGHT, ConditionOperator.EQ, "12.5"),
                facts("QUALITATIVE", 12.5, false))).isTrue();
    }

    @Test
    @DisplayName("Không có điều kiện nào thì coi như thoả")
    void emptyMatches() {
        assertThat(ApprovalConditionEvaluator.matches(List.of(), facts("QUALITATIVE", 1d, false))).isTrue();
    }
}
