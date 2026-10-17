package com.kpitracking.service.approvalform;

import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.entity.form.VisibilityRule;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.approvalprocess.ConditionOperator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormValuesTest {

    private static final UUID ALICE = UUID.randomUUID();
    private static final String FOLDER = "approval-requests/org/user";

    private static final FormValues.Lookup LOOKUP = new FormValues.Lookup() {
        @Override
        public Map<UUID, String> users(Collection<UUID> ids) {
            return ids.contains(ALICE) ? Map.of(ALICE, "Alice") : Map.of();
        }

        @Override
        public Map<UUID, String> units(Collection<UUID> ids) {
            return Map.of();
        }

        @Override
        public String uploadFolder() {
            return FOLDER;
        }
    };

    private static FormWidget.FormWidgetBuilder w(String id, WidgetType type) {
        return FormWidget.builder().id(id).type(type).title(id);
    }

    /** Loại (chọn) → lý do (chỉ hiện khi loại = khác) → bảng chi phí → tổng = SUM → khoảng ngày. */
    private static final FormSchema SCHEMA = new FormSchema(List.of(
            w("kind", WidgetType.RADIO).required(true)
                    .options(List.of(new FormOption("a", "A"), new FormOption("other", "Other"))).build(),
            w("why", WidgetType.TEXT).required(true)
                    .visibility(List.of(new VisibilityRule("kind", ConditionOperator.IN, List.of("other")))).build(),
            w("items", WidgetType.TABLE).children(List.of(
                    w("amount", WidgetType.AMOUNT).required(true).decimals(0).build(),
                    w("note", WidgetType.TEXT).build())).build(),
            w("total", WidgetType.FORMULA).expression("SUM({items.amount}) * 2").decimals(0).build(),
            w("period", WidgetType.DATE_RANGE).dateFormat("DATE").build(),
            w("who", WidgetType.CONTACT).build(),
            w("files", WidgetType.ATTACHMENT).maxCount(1).build()));

    private static Map<String, Object> input(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    @Test
    void recomputesFormulaAndDurationIgnoringClientNumbers() {
        FormValues.Result r = FormValues.normalize(SCHEMA, input(
                "kind", "a",
                "items", List.of(Map.of("amount", 1000), Map.of("amount", "500", "note", " x "), Map.of()),
                "total", 1,
                "period", Map.of("start", "2026-10-01", "end", "2026-10-05", "duration", 99),
                "unknown", "dropped"), LOOKUP, true);

        assertThat(r.values()).containsOnlyKeys("kind", "items", "total", "period");
        assertThat((List<?>) r.values().get("items")).hasSize(2);
        assertThat(r.values().get("total")).isEqualTo(new BigDecimal("3000"));
        assertThat(((Map<?, ?>) r.values().get("period")).get("duration")).isEqualTo(BigDecimal.valueOf(5));
        assertThat(r.facts()).containsEntry("total", 3000d).containsEntry("period", 5d).containsEntry("kind", List.of("a"));
    }

    @Test
    void hiddenWidgetIsNotRequiredAndItsValueIsDropped() {
        FormValues.Result r = FormValues.normalize(SCHEMA, input("kind", "a", "why", "ignored"), LOOKUP, true);
        assertThat(r.values()).doesNotContainKey("why");

        assertThatThrownBy(() -> FormValues.normalize(SCHEMA, input("kind", "other"), LOOKUP, true))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_REQUEST_FIELD_REQUIRED);
    }

    @Test
    void rejectsUnknownOptionsPeopleAndForeignFiles() {
        assertInvalid(input("kind", "zzz"));
        assertInvalid(input("kind", "a", "who", List.of(UUID.randomUUID().toString())));
        assertInvalid(input("kind", "a", "files", List.of(Map.of("publicId", "approval-requests/org/other/x.pdf",
                "url", "https://res.cloudinary.com/x/approval-requests/org/other/x.pdf"))));
        assertInvalid(input("kind", "a", "period", Map.of("start", "2026-10-05", "end", "2026-10-01")));
        assertInvalid(input("kind", "a", "items", List.of(Map.of("note", "no amount"))));
    }

    @Test
    void resolvesPeopleNamesFromLookupAndKeepsOwnFiles() {
        FormValues.Result r = FormValues.normalize(SCHEMA, input("kind", "a",
                "who", List.of(Map.of("id", ALICE.toString(), "name", "spoofed")),
                "files", List.of(Map.of("publicId", FOLDER + "/f.pdf", "url", "https://res.cloudinary.com/x/" + FOLDER + "/f.pdf",
                        "name", "f.pdf", "size", 10))), LOOKUP, true);
        assertThat(r.values().get("who")).isEqualTo(List.of(Map.of("id", ALICE.toString(), "name", "Alice")));
        assertThat((List<?>) r.values().get("files")).hasSize(1);
    }

    @Test
    void lenientModeSkipsInsteadOfFailing() {
        FormValues.Result r = FormValues.normalize(SCHEMA, input("kind", "zzz"), LOOKUP, false);
        // Công thức luôn có số (trống tính là 0); giá trị sai thì bị bỏ.
        assertThat(r.values()).containsOnlyKeys("total");
    }

    private static void assertInvalid(Map<String, Object> values) {
        assertThatThrownBy(() -> FormValues.normalize(SCHEMA, values, LOOKUP, true))
                .isInstanceOf(BusinessException.class);
    }
}
