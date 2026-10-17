package com.kpitracking.service.approvalform;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.entity.form.VisibilityRule;
import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.service.approvalprocess.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Mọi mẫu trong thư viện phải qua đúng bộ kiểm lúc Phát hành — đơn dựng sẵn cho tổ chức nào cũng hợp lệ. */
class ApprovalFormLibraryTest {

    private final ApprovalFormLibrary library = new ApprovalFormLibrary(new ObjectMapper());

    @Test
    void everyTemplateIsValidInBothLanguages() {
        assertThat(library.templates()).hasSizeGreaterThanOrEqualTo(20);
        Set<String> categories = Set.copyOf(library.categories().stream().map(ApprovalFormLibrary.Category::code).toList());
        for (ApprovalFormLibrary.Template t : library.templates()) {
            assertThat(categories).as(t.code()).contains(t.category());
            assertThat(t.name()).as(t.code()).containsKeys("vi", "en");
            for (String lang : List.of("vi", "en")) {
                FormSchema schema = library.schema(t, lang);
                assertThat(FormSchemaValidator.validate(schema)).as(t.code() + "/" + lang).isEmpty();
                ProcessGraphValidator.Result result = ProcessGraphValidator.validate(library.process(t, lang),
                        ApprovalObjectType.FORM_REQUEST, FormSchemaValidator.index(schema));
                assertThat(result.errors()).as(t.code() + "/" + lang).isEmpty();
            }
        }
    }

    @Test
    void preinstalledGroupsOnlyUseKnownTemplates() {
        for (ApprovalFormLibrary.Preinstalled p : library.preinstalled()) {
            for (String code : p.templates()) assertThat(library.template(code)).as(code).isPresent();
        }
    }

    @Test
    void leaveProcessAddsSeniorManagerOnlyAboveThreeDays() {
        ApprovalFormLibrary.Template leave = library.template("LEAVE").orElseThrow();
        ProcessGraph graph = library.process(leave, "vi");
        assertThat(ApprovalProcessPlanner.walk(graph, facts(Map.of("period", 5d))).steps()).hasSize(2);
        assertThat(ApprovalProcessPlanner.walk(graph, facts(Map.of("period", 2d))).steps()).hasSize(1);
        // Không có số (widget bị ẩn / trống) ⇒ so số luôn sai ⇒ nhánh "không".
        assertThat(ApprovalProcessPlanner.walk(graph, facts(Map.of())).steps()).hasSize(1);
        assertThat(library.schema(leave, "en").widgetsOrEmpty().get(0).title()).isEqualTo("Leave type");
    }

    @Test
    void optionConditionsReadSelectedOptionIds() {
        ProcessGraph.ConditionRule rule = new ProcessGraph.ConditionRule(ConditionField.FORM_OPTION,
                ConditionOperator.IN, List.of("unpaid"), "leave_type");
        assertThat(ApprovalConditionEvaluator.test(rule, facts(Map.of("leave_type", List.of("unpaid"))))).isTrue();
        assertThat(ApprovalConditionEvaluator.test(rule, facts(Map.of("leave_type", List.of("annual"))))).isFalse();
    }

    @Test
    void schemaValidatorCatchesTheIssuesThePublishPopoverShows() {
        FormWidget a = FormWidget.builder().id("a").type(WidgetType.NUMBER).title("Same").build();
        FormWidget b = FormWidget.builder().id("b").type(WidgetType.TEXT).title("same ").build();
        FormWidget c = FormWidget.builder().id("c").type(WidgetType.RADIO).title("C").options(List.of()).build();
        FormWidget d = FormWidget.builder().id("d").type(WidgetType.FORMULA).title("D").expression("{b} + 1").build();
        FormWidget e = FormWidget.builder().id("e").type(WidgetType.TEXT).title("E")
                .visibility(List.of(new VisibilityRule("f", ConditionOperator.IN, List.of("x")))).build();
        FormWidget f = FormWidget.builder().id("f").type(WidgetType.RADIO).title("F")
                .options(List.of(new FormOption("x", "X"))).build();
        List<FormSchemaValidator.Issue> issues = FormSchemaValidator.validate(new FormSchema(List.of(a, b, c, d, e, f)));
        assertThat(issues).extracting(FormSchemaValidator.Issue::widgetId, FormSchemaValidator.Issue::key)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("b", "approvalForm.schema.titleDuplicate"),
                        org.assertj.core.groups.Tuple.tuple("c", "approvalForm.schema.optionsRequired"),
                        org.assertj.core.groups.Tuple.tuple("d", "approvalForm.schema.formulaBadRef"),
                        org.assertj.core.groups.Tuple.tuple("e", "approvalForm.schema.visibilityInvalid"));
    }

    @Test
    void processConditionOnDeletedWidgetIsRejected() {
        ProcessGraph graph = library.process(library.template("REIMBURSEMENT").orElseThrow(), "vi");
        FormFieldIndex withoutTotal = new FormFieldIndex(Set.of(), Map.of());
        assertThat(ProcessGraphValidator.validate(graph, ApprovalObjectType.FORM_REQUEST, withoutTotal).errors())
                .extracting(ProcessGraphValidator.Issue::key).contains("approvalProcess.graph.ruleWidgetMissing");
    }

    private static ApprovalSubjectFacts facts(Map<String, Object> form) {
        return ApprovalSubjectFacts.forForm(null, null, Set.of(), form);
    }
}
