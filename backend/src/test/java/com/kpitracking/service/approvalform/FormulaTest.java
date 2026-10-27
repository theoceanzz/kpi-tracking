package com.kpitracking.service.approvalform;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormulaTest {

    private static Double eval(String expr, Map<String, Double> values) {
        return Formula.parse(expr).evaluate(r -> values.get(r.sum() ? r.widget() + "." + r.column() : r.widget()));
    }

    @Test
    void precedenceParenthesesAndUnaryMinus() {
        assertThat(eval("1 + 2 * 3", Map.of())).isEqualTo(7d);
        assertThat(eval("(1 + 2) * 3", Map.of())).isEqualTo(9d);
        assertThat(eval("-{a} + 10 / 4", Map.of("a", 1d))).isEqualTo(1.5d);
    }

    @Test
    void referencesAndColumnSums() {
        Formula f = Formula.parse("{qty} * {price} + SUM({items.amount})");
        assertThat(f.refs()).extracting(Formula.Ref::widget).containsExactly("qty", "price", "items");
        assertThat(eval("{qty} * {price} + SUM({items.amount})",
                Map.of("qty", 2d, "price", 3d, "items.amount", 100d))).isEqualTo(106d);
    }

    @Test
    void missingIsZeroAndDivisionByZeroIsEmpty() {
        assertThat(eval("{a} + 5", Map.of())).isEqualTo(5d);
        assertThat(eval("10 / {a}", Map.of())).isNull();
    }

    @Test
    void rejectsBadSyntax() {
        assertThatThrownBy(() -> Formula.parse("1 +")).isInstanceOf(Formula.FormulaException.class);
        assertThatThrownBy(() -> Formula.parse("{items.amount}")).isInstanceOf(Formula.FormulaException.class);
        assertThatThrownBy(() -> Formula.parse("SUM({a})")).isInstanceOf(Formula.FormulaException.class);
        assertThatThrownBy(() -> Formula.parse("2 ^ 3")).isInstanceOf(Formula.FormulaException.class);
        assertThatThrownBy(() -> Formula.parse(" ")).isInstanceOf(Formula.FormulaException.class);
    }
}
