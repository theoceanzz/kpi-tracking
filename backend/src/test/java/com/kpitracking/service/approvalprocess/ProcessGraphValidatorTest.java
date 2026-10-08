package com.kpitracking.service.approvalprocess;

import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ProcessGraph.Branch;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.service.approvalprocess.Graphs.*;
import static org.assertj.core.api.Assertions.assertThat;

/** Luật sơ đồ quy trình duyệt và cách đánh số bước — thuần logic. */
class ProcessGraphValidatorTest {

    private static final ApprovalObjectType KPI = ApprovalObjectType.KPI_CRITERIA;
    private final UUID someone = UUID.randomUUID();

    /** Mẫu 1Office: Bắt đầu → Điều kiện → (✓) 1.1 → 2 → Đã duyệt, (✗) 1.2 → Đã duyệt. */
    private ProcessGraph sample() {
        return graph()
                .condition("c", 0, rule(ConditionField.KPI_TYPE, ConditionOperator.IN, "QUALITATIVE"))
                .step("s11", 0, user(someone))
                .step("s12", 150, manager(0))
                .step("s2", 0, role(UUID.randomUUID()))
                .approved("ok")
                .rejected("no")
                .next("start", "c")
                .link("c", "s11", Branch.YES)
                .link("c", "s12", Branch.NO)
                .next("s11", "s2")
                .next("s2", "ok")
                .next("s12", "ok")
                .link("s11", "no", Branch.REJECT)
                .build();
    }

    private static List<String> errorKeys(ProcessGraph g) {
        return ProcessGraphValidator.validate(g, KPI).errors().stream().map(ProcessGraphValidator.Issue::key).toList();
    }

    @Test
    @DisplayName("Sơ đồ mẫu hợp lệ, đánh số 1.1 / 1.2 / 2 như 1Office")
    void sampleIsValidAndNumbered() {
        ProcessGraph g = sample();
        ProcessGraphValidator.Result r = ProcessGraphValidator.validate(g, KPI);
        assertThat(r.errors()).isEmpty();
        assertThat(g.stepCodes()).containsEntry("s11", "1.1").containsEntry("s12", "1.2").containsEntry("s2", "2");
    }

    @Test
    @DisplayName("Chuỗi thẳng một nhánh: mỗi cấp một bước nên mã là 1, 2, 3")
    void linearCodes() {
        ProcessGraph g = graph().step("a", 0, manager(0)).step("b", 0, manager(1)).step("c", 0, user(someone))
                .next("start", "a").next("a", "b").next("b", "c").build();
        assertThat(g.stepCodes()).containsEntry("a", "1").containsEntry("b", "2").containsEntry("c", "3");
        // Bước cuối không nối tiếp: chỉ cảnh báo, duyệt xong là Đã duyệt.
        ProcessGraphValidator.Result r = ProcessGraphValidator.validate(g, KPI);
        assertThat(r.errors()).isEmpty();
        assertThat(r.warnings()).extracting(ProcessGraphValidator.Issue::key)
                .containsExactly("approvalProcess.graph.stepImplicitApproved");
    }

    @Test
    @DisplayName("Hai nhánh hội về một bước: cấp tính theo đường dài nhất")
    void mergeUsesLongestPath() {
        ProcessGraph g = graph()
                .condition("c", 0, rule(ConditionField.WEIGHT, ConditionOperator.GT, "10"))
                .step("a", 0, manager(0)).step("b", 0, manager(1)).step("z", 0, user(someone))
                .next("start", "c").link("c", "a", Branch.YES).link("c", "z", Branch.NO)
                .next("a", "b").next("b", "z").build();
        assertThat(g.stepCodes()).containsEntry("a", "1").containsEntry("b", "2").containsEntry("z", "3");
    }

    @Test
    @DisplayName("Điều kiện thiếu nhánh không thỏa mãn là lỗi")
    void conditionNeedsBothBranches() {
        ProcessGraph g = graph()
                .condition("c", 0, rule(ConditionField.KPI_TYPE, ConditionOperator.IN, "QUALITATIVE"))
                .step("a", 0, manager(0))
                .next("start", "c").link("c", "a", Branch.YES).build();
        assertThat(errorKeys(g)).contains("approvalProcess.graph.conditionNeedsNo");
    }

    @Test
    @DisplayName("Nhánh tới Đã duyệt mà không qua bước nào bị chặn (không có tự duyệt theo điều kiện)")
    void approvedWithoutStepRejected() {
        ProcessGraph g = graph()
                .condition("c", 0, rule(ConditionField.IS_BONUS, ConditionOperator.IS_TRUE))
                .step("a", 0, manager(0)).approved("ok")
                .next("start", "c").link("c", "ok", Branch.YES).link("c", "a", Branch.NO).next("a", "ok").build();
        assertThat(errorKeys(g)).contains("approvalProcess.graph.approvedWithoutStep");
    }

    @Test
    @DisplayName("Vòng lặp bị chặn")
    void cycleRejected() {
        ProcessGraph g = graph().step("a", 0, manager(0)).step("b", 0, manager(1))
                .next("start", "a").next("a", "b").next("b", "a").build();
        assertThat(errorKeys(g)).contains("approvalProcess.graph.cycle");
    }

    @Test
    @DisplayName("Bước thiếu tên / người duyệt, Không duyệt nối bằng cạnh tiếp — đều là lỗi")
    void stepRules() {
        ProcessGraph g = new ProcessGraph(1, List.of(
                new ProcessGraph.Node("start", ProcessGraph.NodeType.START, 0d, 0d, null, null, null),
                new ProcessGraph.Node("a", ProcessGraph.NodeType.STEP, 0d, 0d, " ", null, List.of()),
                new ProcessGraph.Node("no", ProcessGraph.NodeType.REJECTED, 0d, 0d, null, null, null)),
                List.of(new ProcessGraph.Edge("e1", "start", "a", Branch.NEXT),
                        new ProcessGraph.Edge("e2", "a", "no", Branch.NEXT)));
        assertThat(errorKeys(g)).contains("approvalProcess.graph.stepNoName", "approvalProcess.graph.stepNoApprover",
                "approvalProcess.graph.rejectedOnlyFromStep");
    }

    @Test
    @DisplayName("Trường chỉ dành cho điều chỉnh không dùng được ở quy trình Giao KPI; số phải là số")
    void ruleRules() {
        ProcessGraph g = graph()
                .condition("c", 0, rule(ConditionField.TARGET_CHANGE_PERCENT, ConditionOperator.GT, "10"),
                        rule(ConditionField.WEIGHT, ConditionOperator.GT, "mười"),
                        rule(ConditionField.KPI_TYPE, ConditionOperator.GT, "QUALITATIVE"))
                .step("a", 0, manager(0)).step("b", 10, manager(1))
                .next("start", "c").link("c", "a", Branch.YES).link("c", "b", Branch.NO).build();
        assertThat(errorKeys(g)).contains("approvalProcess.graph.ruleFieldNotForObject",
                "approvalProcess.graph.ruleBadNumber", "approvalProcess.graph.ruleBadOperator");
        assertThat(ProcessGraphValidator.validate(g, ApprovalObjectType.KPI_ADJUSTMENT).errors())
                .extracting(ProcessGraphValidator.Issue::key)
                .doesNotContain("approvalProcess.graph.ruleFieldNotForObject");
    }

    @Test
    @DisplayName("Node lẻ không nối từ Bắt đầu chỉ là cảnh báo")
    void unreachableIsWarning() {
        ProcessGraph g = graph().step("a", 0, manager(0)).step("lone", 300, manager(1)).next("start", "a").build();
        ProcessGraphValidator.Result r = ProcessGraphValidator.validate(g, KPI);
        assertThat(r.errors()).isEmpty();
        assertThat(r.warnings()).extracting(ProcessGraphValidator.Issue::nodeId).contains("lone");
    }

    @Test
    @DisplayName("Sơ đồ rỗng, hoặc không có Bắt đầu")
    void structural() {
        assertThat(errorKeys(new ProcessGraph(1, List.of(), List.of()))).containsExactly("approvalProcess.graph.empty");
        ProcessGraph noStart = new ProcessGraph(1, List.of(
                new ProcessGraph.Node("a", ProcessGraph.NodeType.STEP, 0d, 0d, "A", null, List.of(manager(0)))), List.of());
        assertThat(errorKeys(noStart)).containsExactly("approvalProcess.graph.startCount");
    }
}
