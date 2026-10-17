package com.kpitracking.service.approvalprocess;

import com.kpitracking.service.approvalprocess.ProcessGraph.ConditionGroup;
import com.kpitracking.service.approvalprocess.ProcessGraph.ConditionRule;

import java.math.BigDecimal;
import java.util.*;

/**
 * Đánh giá điều kiện duyệt trên {@link ApprovalSubjectFacts} — thuần logic.
 *
 * <p>Giữa các nhóm là HOẶC, trong một nhóm là VÀ. Giá trị của đối tượng không có (KPI không có
 * trọng số, yêu cầu xin dừng thì không có % đổi chỉ tiêu…) thì mọi phép so sánh số đều sai — kể
 * cả "khác": điều kiện chỉ đúng khi dữ liệu thật sự cho thấy nó đúng.
 */
public final class ApprovalConditionEvaluator {

    private ApprovalConditionEvaluator() {}

    public static boolean matches(List<ConditionGroup> groups, ApprovalSubjectFacts facts) {
        if (groups == null || groups.isEmpty()) return true;
        for (ConditionGroup g : groups) {
            List<ConditionRule> rules = g.rulesOrEmpty();
            if (!rules.isEmpty() && rules.stream().allMatch(r -> test(r, facts))) return true;
        }
        return false;
    }

    public static boolean test(ConditionRule rule, ApprovalSubjectFacts f) {
        if (rule == null || rule.field() == null || rule.operator() == null) return false;
        List<String> values = rule.valuesOrEmpty().stream()
                .filter(Objects::nonNull).map(String::trim).filter(v -> !v.isEmpty()).toList();
        return switch (rule.field().valueType()) {
            case NUMBER -> compareNumber(numberOf(rule, f), rule.operator(), values);
            case BOOLEAN -> switch (rule.operator()) {
                case IS_TRUE -> booleanOf(rule.field(), f);
                case IS_FALSE -> !booleanOf(rule.field(), f);
                default -> false;
            };
            default -> testSet(rule, f, values);
        };
    }

    private static boolean testSet(ConditionRule rule, ApprovalSubjectFacts f, List<String> values) {
        Set<String> wanted = new HashSet<>();
        values.forEach(v -> wanted.add(v.toLowerCase(Locale.ROOT)));
        if (rule.operator() == ConditionOperator.IN_SUBTREE) {
            if (rule.field() != ConditionField.ORG_UNIT) return false;
            return f.orgUnitAncestry().stream().anyMatch(id -> wanted.contains(id.toString()));
        }
        Set<String> actual = new HashSet<>();
        for (Object v : setOf(rule, f)) {
            if (v != null) actual.add(v.toString().toLowerCase(Locale.ROOT));
        }
        boolean any = actual.stream().anyMatch(wanted::contains);
        return switch (rule.operator()) {
            case IN -> any;
            case NOT_IN -> !any;
            default -> false;
        };
    }

    private static Collection<?> setOf(ConditionRule rule, ApprovalSubjectFacts f) {
        return switch (rule.field()) {
            case ORG_UNIT -> single(f.orgUnitId());
            case ORG_LEVEL -> single(f.orgLevelId());
            case REQUESTER -> single(f.requesterId());
            case REQUESTER_ROLE -> f.requesterRoleIds();
            case KPI_TYPE -> single(f.kpiType());
            case FREQUENCY -> single(f.frequency());
            case PERIOD -> single(f.periodId());
            case REQUEST_KIND -> single(f.requestKind());
            case FORM_OPTION -> f.formOrEmpty().get(rule.widget()) instanceof Collection<?> c ? c : List.of();
            default -> List.of();
        };
    }

    private static List<Object> single(Object v) {
        return v == null ? List.of() : List.of(v);
    }

    private static Double numberOf(ConditionRule rule, ApprovalSubjectFacts f) {
        return switch (rule.field()) {
            case WEIGHT -> f.weight();
            case TARGET_CHANGE_PERCENT -> f.targetChangePercent();
            case EVAL_SCORE, REWARD_POINTS -> f.score();
            case FORM_NUMBER -> f.formOrEmpty().get(rule.widget()) instanceof Number n ? n.doubleValue() : null;
            default -> null;
        };
    }

    private static boolean booleanOf(ConditionField field, ApprovalSubjectFacts f) {
        return field == ConditionField.IS_BONUS && f.bonus();
    }

    private static boolean compareNumber(Double actual, ConditionOperator op, List<String> values) {
        if (actual == null || actual.isNaN() || values.isEmpty()) return false;
        BigDecimal expected = ProcessGraphValidator.parseNumber(values.get(0));
        if (expected == null) return false;
        int c = BigDecimal.valueOf(actual).compareTo(expected);
        return switch (op) {
            case EQ -> c == 0;
            case NEQ -> c != 0;
            case GT -> c > 0;
            case GTE -> c >= 0;
            case LT -> c < 0;
            case LTE -> c <= 0;
            default -> false;
        };
    }
}
