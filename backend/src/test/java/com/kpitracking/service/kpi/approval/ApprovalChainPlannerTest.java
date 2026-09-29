package com.kpitracking.service.kpi.approval;

import com.kpitracking.service.kpi.approval.ApprovalChainPlanner.Head;
import com.kpitracking.service.kpi.approval.ApprovalChainPlanner.Plan;
import com.kpitracking.service.kpi.approval.ApprovalChainPlanner.PlannedStep;
import com.kpitracking.service.kpi.approval.ApprovalChainPlanner.UnitHeads;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật lập chuỗi duyệt — thuần logic. Cây mẫu: Phòng (A) ⊂ Khối (B) ⊂ Công ty (C, gốc).
 */
class ApprovalChainPlannerTest {

    private final UUID staff = UUID.randomUUID();
    private final UUID headA = UUID.randomUUID();
    private final UUID headB = UUID.randomUUID();
    private final UUID headC = UUID.randomUUID();

    private static Head head(UUID id, String name) {
        return new Head(id, name, true, true);
    }

    private static UnitHeads unit(String name, Head... heads) {
        return new UnitHeads(UUID.randomUUID(), name, List.of(heads));
    }

    private List<UnitHeads> threeLevels() {
        return List.of(
                unit("Phòng A", head(headA, "Trưởng A")),
                unit("Khối B", head(headB, "Trưởng B")),
                unit("Công ty C", head(headC, "Giám đốc C")));
    }

    private static List<String> holders(Plan plan) {
        return plan.steps().stream()
                .map(s -> s.actionable() ? s.approvers().get(0).name() : "SKIP:" + s.unitName())
                .toList();
    }

    @Test
    @DisplayName("Test 1: chuỗi 3 cấp đi đủ trưởng A → trưởng B → giám đốc C")
    void threeLevelChain() {
        Plan plan = ApprovalChainPlanner.plan(staff, threeLevels());
        assertThat(holders(plan)).containsExactly("Trưởng A", "Trưởng B", "Giám đốc C");
        assertThat(plan.requesterIsTopHead()).isFalse();
    }

    @Test
    @DisplayName("Test 6a: người tạo là trưởng đơn vị ⇒ chuỗi bắt đầu từ cấp trên")
    void creatorIsUnitHead() {
        Plan plan = ApprovalChainPlanner.plan(headA, threeLevels());
        assertThat(holders(plan)).containsExactly("Trưởng B", "Giám đốc C");
    }

    @Test
    @DisplayName("Test 6b: một người kiêm trưởng nhiều cấp liên tiếp ⇒ gộp một bước")
    void samePersonHeadsConsecutiveLevels() {
        List<UnitHeads> path = List.of(
                unit("Phòng A", head(headA, "Trưởng A")),
                unit("Khối B", head(headB, "Trưởng B")),
                unit("Ban C1", head(headB, "Trưởng B")),
                unit("Công ty C", head(headC, "Giám đốc C")));
        Plan plan = ApprovalChainPlanner.plan(staff, path);
        assertThat(holders(plan)).containsExactly("Trưởng A", "Trưởng B", "Giám đốc C");
        PlannedStep merged = plan.steps().get(1);
        assertThat(merged.mergedUnits()).extracting(UnitHeads::unitName).containsExactly("Ban C1");
    }

    @Test
    @DisplayName("Test 6c: đơn vị chưa có trưởng ⇒ bước bỏ qua kèm lý do, chuỗi lên cấp trên")
    void unitWithoutHead() {
        List<UnitHeads> path = List.of(
                unit("Phòng A"),
                unit("Khối B", head(headB, "Trưởng B")),
                unit("Công ty C", head(headC, "Giám đốc C")));
        Plan plan = ApprovalChainPlanner.plan(staff, path);
        assertThat(holders(plan)).containsExactly("SKIP:Phòng A", "Trưởng B", "Giám đốc C");
        assertThat(plan.steps().get(0).skipReason()).isEqualTo(ApprovalChainPlanner.REASON_NO_HEAD);
    }

    @Test
    @DisplayName("Trưởng bị vô hiệu hoá / không có quyền duyệt ⇒ bỏ qua với lý do tương ứng")
    void inactiveOrUnauthorizedHead() {
        List<UnitHeads> path = List.of(
                new UnitHeads(UUID.randomUUID(), "Phòng A", List.of(new Head(headA, "Trưởng A", false, true))),
                new UnitHeads(UUID.randomUUID(), "Khối B", List.of(new Head(headB, "Trưởng B", true, false))),
                unit("Công ty C", head(headC, "Giám đốc C")));
        Plan plan = ApprovalChainPlanner.plan(staff, path);
        assertThat(holders(plan)).containsExactly("SKIP:Phòng A", "SKIP:Khối B", "Giám đốc C");
        assertThat(plan.steps().get(0).skipReason()).isEqualTo(ApprovalChainPlanner.REASON_HEAD_INACTIVE);
        assertThat(plan.steps().get(1).skipReason()).isEqualTo(ApprovalChainPlanner.REASON_HEAD_NO_PERMISSION);
    }

    @Test
    @DisplayName("Test 6d: không ai tự duyệt — người tạo không bao giờ nằm trong chuỗi")
    void creatorNeverInChain() {
        // Người tạo là trưởng Khối B nhưng KPI thuộc Phòng A (cấp dưới của họ): trưởng A là cấp dưới
        // nên cũng không được duyệt; chuỗi chỉ còn giám đốc C.
        Plan plan = ApprovalChainPlanner.plan(headB, threeLevels());
        assertThat(holders(plan)).containsExactly("Giám đốc C");
        assertThat(plan.steps()).allSatisfy(s ->
                assertThat(s.approvers()).extracting(Head::userId).doesNotContain(headB));
    }

    @Test
    @DisplayName("Đơn vị nhiều trưởng ⇒ một bước giữ bởi cả nhóm")
    void multipleHeadsFormGroup() {
        UUID coHead = UUID.randomUUID();
        List<UnitHeads> path = List.of(
                unit("Phòng A", head(headA, "Trưởng A"), head(coHead, "Đồng trưởng A")),
                unit("Công ty C", head(headC, "Giám đốc C")));
        Plan plan = ApprovalChainPlanner.plan(staff, path);
        assertThat(plan.steps().get(0).approvers()).extracting(Head::userId).containsExactlyInAnyOrder(headA, coHead);
    }

    @Test
    @DisplayName("C3: người tạo là giám đốc (trưởng gốc) ⇒ đồng trưởng ở gốc duyệt; không còn ai thì chuỗi rỗng")
    void creatorIsTopHead() {
        Plan alone = ApprovalChainPlanner.plan(headC, threeLevels());
        assertThat(alone.steps()).isEmpty();
        assertThat(alone.requesterIsTopHead()).isTrue();
        assertThat(alone.hasActionableStep()).isFalse();

        UUID otherDirector = UUID.randomUUID();
        List<UnitHeads> board = List.of(
                unit("Phòng A", head(headA, "Trưởng A")),
                unit("Công ty C", head(headC, "Giám đốc C"), head(otherDirector, "Phó TGĐ")));
        Plan withPeer = ApprovalChainPlanner.plan(headC, board);
        assertThat(holders(withPeer)).containsExactly("Phó TGĐ");
        assertThat(withPeer.requesterIsTopHead()).isTrue();
    }
}
