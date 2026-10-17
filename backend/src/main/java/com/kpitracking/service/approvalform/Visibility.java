package com.kpitracking.service.approvalform;

import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.entity.form.VisibilityRule;
import com.kpitracking.service.approvalprocess.ConditionOperator;

import java.math.BigDecimal;
import java.util.*;

/**
 * Điều kiện hiện widget — thuần logic, cùng luật với {@code model/visibility.ts}. Mọi điều kiện của một widget
 * phải đúng (VÀ). Widget nguồn trống hoặc bị ẩn: "thuộc" sai, "không thuộc" đúng, so số luôn sai.
 */
public final class Visibility {

    static final Set<ConditionOperator> NUMBER_OPS = EnumSet.of(ConditionOperator.EQ, ConditionOperator.NEQ,
            ConditionOperator.GT, ConditionOperator.GTE, ConditionOperator.LT, ConditionOperator.LTE);

    private Visibility() {}

    /**
     * @param numbers giá trị số của các widget đứng trước (đang hiện)
     * @param options id phương án đã chọn của các widget chọn đứng trước (đang hiện)
     */
    public static boolean visible(FormWidget w, Map<String, Double> numbers, Map<String, List<String>> options) {
        for (VisibilityRule r : w.visibilityOrEmpty()) {
            if (r == null || !test(r, numbers, options)) return false;
        }
        return true;
    }

    private static boolean test(VisibilityRule r, Map<String, Double> numbers, Map<String, List<String>> options) {
        if (r.operator() == ConditionOperator.IN || r.operator() == ConditionOperator.NOT_IN) {
            List<String> chosen = options.getOrDefault(r.widget(), List.of());
            boolean any = chosen.stream().anyMatch(r.valuesOrEmpty()::contains);
            return r.operator() == ConditionOperator.IN ? any : !any;
        }
        Double actual = numbers.get(r.widget());
        BigDecimal expected = r.valuesOrEmpty().isEmpty() ? null : FormSchemaValidator.parse(r.valuesOrEmpty().get(0));
        if (actual == null || expected == null || !NUMBER_OPS.contains(r.operator())) return false;
        int c = BigDecimal.valueOf(actual).compareTo(expected);
        return switch (r.operator()) {
            case EQ -> c == 0;
            case NEQ -> c != 0;
            case GT -> c > 0;
            case GTE -> c >= 0;
            case LT -> c < 0;
            default -> c <= 0;
        };
    }
}
