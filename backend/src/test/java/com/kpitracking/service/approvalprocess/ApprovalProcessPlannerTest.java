package com.kpitracking.service.approvalprocess;

import com.fasterxml.jackson.databind.ObjectMapper;


import com.kpitracking.repository.approvalprocess.ApprovalProcessRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.service.approvalprocess.ProcessGraph.Branch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.*;

import static com.kpitracking.service.approvalprocess.Graphs.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.approvalprocess.ApprovalProcess;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.OrgHierarchyLevel;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.enums.kpi.KpiFrequency;
import com.kpitracking.enums.kpi.KpiType;
import com.kpitracking.enums.user.UserStatus;
/**
 * Lập bước theo quy trình trên cây mẫu: Phòng A ⊂ Khối B ⊂ Công ty C (gốc). Nhân viên ở A; trưởng
 * A, trưởng B, giám đốc C; một "Thư ký" giữ chức vụ thư ký ở Khối B.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ApprovalProcessPlannerTest {

    @Mock ApprovalProcessRepository processRepository;
    @Mock UserRoleOrgUnitRepository uroRepository;
    @Mock UserRepository userRepository;

    private final ProcessGraphCodec codec = new ProcessGraphCodec(new ObjectMapper());
    private ApprovalProcessPlanner planner;

    private final UUID orgId = UUID.randomUUID();
    private OrgUnit unitA, unitB, unitC;
    private User staff, headA, headB, headC, secretary;
    private Role headRole, secretaryRole, staffRole;
    private final Map<UUID, List<UserRoleOrgUnit>> byUnit = new HashMap<>();

    @BeforeEach
    void setUp() {
        planner = new ApprovalProcessPlanner(processRepository, uroRepository, userRepository, codec);
        Organization org = Organization.builder().id(orgId).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().id(UUID.randomUUID()).organization(org).build();
        unitC = OrgUnit.builder().id(UUID.randomUUID()).name("Công ty C").path("/c/").orgHierarchyLevel(level).build();
        unitB = OrgUnit.builder().id(UUID.randomUUID()).name("Khối B").path("/c/b/").parent(unitC).orgHierarchyLevel(level).build();
        unitA = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng A").path("/c/b/a/").parent(unitB).orgHierarchyLevel(level).build();

        headRole = Role.builder().id(UUID.randomUUID()).name("Trưởng").rank(0).build();
        secretaryRole = Role.builder().id(UUID.randomUUID()).name("Thư ký").rank(2).build();
        staffRole = Role.builder().id(UUID.randomUUID()).name("Nhân viên").rank(2).build();

        staff = user("Nhân viên");
        headA = user("Trưởng A");
        headB = user("Trưởng B");
        headC = user("Giám đốc C");
        secretary = user("Thư ký B");

        assign(unitA, staffRole, staff);
        assign(unitA, headRole, headA);
        assign(unitB, headRole, headB);
        assign(unitB, secretaryRole, secretary);
        assign(unitC, headRole, headC);
        when(uroRepository.findByOrgUnitId(any())).thenAnswer(inv -> byUnit.getOrDefault((UUID) inv.getArgument(0), List.of()));
        when(uroRepository.findByUserId(any())).thenReturn(List.of());
        for (User u : List.of(staff, headA, headB, headC, secretary)) {
            when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        }
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).fullName(name).email(name + "@x").status(UserStatus.ACTIVE).build();
    }

    private void assign(OrgUnit unit, Role role, User u) {
        byUnit.computeIfAbsent(unit.getId(), k -> new ArrayList<>())
                .add(UserRoleOrgUnit.builder().user(u).role(role).orgUnit(unit).build());
    }

    private KpiCriteria kpi(KpiType type) {
        return KpiCriteria.builder().id(UUID.randomUUID()).name("Doanh thu").orgUnit(unitA).kpiType(type)
                .frequency(KpiFrequency.MONTHLY).weight(20d).build();
    }

    private ApprovalProcess process(String title, List<String> subs, ProcessGraph graph) {
        return ApprovalProcess.builder().id(UUID.randomUUID()).organizationId(orgId).title(title)
                .objectType(ApprovalObjectType.KPI_CRITERIA).subObjectTypes(new ArrayList<>(subs))
                .definition(codec.write(graph)).createdAt(Instant.now()).build();
    }

    private void active(ApprovalProcess... processes) {
        when(processRepository.findByOrganizationIdAndObjectTypeAndActiveTrue(eq(orgId), eq(ApprovalObjectType.KPI_CRITERIA)))
                .thenReturn(List.of(processes));
    }

    private static List<List<String>> holders(ApprovalProcessPlanner.ProcessPlan plan) {
        return plan.steps().stream().map(s -> s.approvers().stream().map(ApprovalProcessPlanner.Holder::name).toList()).toList();
    }

    /** Điều kiện "KPI định tính": ✓ → trưởng trực tiếp → thư ký (chức vụ); ✗ → giám đốc (trưởng đơn vị C). */
    private ProcessGraph branching() {
        return graph()
                .condition("c", 0, rule(ConditionField.KPI_TYPE, ConditionOperator.IN, "QUALITATIVE"))
                .step("s11", 0, manager(0))
                .step("s12", 150, unitHead(unitC.getId()))
                .step("s2", 0, role(secretaryRole.getId()))
                .approved("ok")
                .next("start", "c")
                .link("c", "s11", Branch.YES)
                .link("c", "s12", Branch.NO)
                .next("s11", "s2").next("s2", "ok").next("s12", "ok")
                .build();
    }

    @Test
    @DisplayName("Không có quy trình nào ⇒ rỗng, phía gọi đi chuỗi trưởng đơn vị mặc định")
    void noProcess() {
        active();
        assertThat(planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUALITATIVE), null, staff)).isEmpty();
    }

    @Test
    @DisplayName("Nhánh ✓: trưởng trực tiếp rồi người giữ chức vụ ở đơn vị gần nhất; mã bước 1.1 → 2")
    void yesBranch() {
        active(process("Quy trình", List.of(), branching()));
        var plan = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUALITATIVE), null, staff).orElseThrow();
        assertThat(holders(plan)).containsExactly(List.of("Trưởng A"), List.of("Thư ký B"));
        assertThat(plan.steps()).extracting(ApprovalProcessPlanner.PlannedStep::code).containsExactly("1.1", "2");
        assertThat(plan.snapshot().get("pathNodeIds")).isEqualTo(List.of("start", "c", "s11", "s2", "ok"));
    }

    @Test
    @DisplayName("Nhánh ✗: trưởng của đơn vị được chọn")
    void noBranch() {
        active(process("Quy trình", List.of(), branching()));
        var plan = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUANTITATIVE), null, staff).orElseThrow();
        assertThat(holders(plan)).containsExactly(List.of("Giám đốc C"));
        assertThat(plan.steps().get(0).code()).isEqualTo("1.2");
    }

    @Test
    @DisplayName("Trưởng gửi: 'trưởng trực tiếp' là cấp trên của họ; cấp trên 1 bậc là giám đốc")
    void managerSkipsRequesterAsHead() {
        ProcessGraph g = graph().step("a", 0, manager(0)).step("b", 0, manager(1))
                .next("start", "a").next("a", "b").build();
        active(process("Hai cấp", List.of(), g));
        var plan = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUANTITATIVE), null, headA).orElseThrow();
        assertThat(holders(plan)).containsExactly(List.of("Trưởng B"), List.of("Giám đốc C"));
    }

    @Test
    @DisplayName("Người gửi bị loại khỏi bước; bước không còn ai thì bỏ qua kèm lý do")
    void requesterExcludedAndEmptyStepSkipped() {
        ProcessGraph g = graph().step("a", 0, Graphs.user(headA.getId())).step("b", 0, Graphs.user(headB.getId()))
                .next("start", "a").next("a", "b").build();
        active(process("Cụ thể", List.of(), g));
        var plan = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUANTITATIVE), null, headA).orElseThrow();
        assertThat(plan.steps().get(0).actionable()).isFalse();
        assertThat(plan.steps().get(0).skipReason()).isEqualTo(ApprovalProcessPlanner.REASON_NO_APPROVER);
        assertThat(plan.steps().get(1).approvers()).extracting(ApprovalProcessPlanner.Holder::name).containsExactly("Trưởng B");
        assertThat(plan.hasActionableStep()).isTrue();
    }

    @Test
    @DisplayName("Tài khoản tạm dừng không giữ bước")
    void pausedAccountExcluded() {
        headB.setStatus(UserStatus.INACTIVE);
        ProcessGraph g = graph().step("a", 0, Graphs.user(headB.getId()), Graphs.user(headC.getId())).next("start", "a").build();
        active(process("Cụ thể", List.of(), g));
        var plan = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUANTITATIVE), null, staff).orElseThrow();
        assertThat(holders(plan)).containsExactly(List.of("Giám đốc C"));
    }

    @Test
    @DisplayName("Quy trình đúng đối tượng con được ưu tiên hơn quy trình 'Tất cả'")
    void specificBeatsAll() {
        ApprovalProcess all = process("Tất cả", List.of(), graph().step("a", 0, Graphs.user(headC.getId())).next("start", "a").build());
        ApprovalProcess qualitative = process("Định tính", List.of("QUALITATIVE"),
                graph().step("a", 0, Graphs.user(headB.getId())).next("start", "a").build());
        assertThat(ApprovalProcessPlanner.select(List.of(all, qualitative), "QUALITATIVE")).contains(qualitative);
        assertThat(ApprovalProcessPlanner.select(List.of(all, qualitative), "QUANTITATIVE")).contains(all);
        assertThat(ApprovalProcessPlanner.select(List.of(qualitative), "QUANTITATIVE")).isEmpty();
    }

    @Test
    @DisplayName("Hiển thị trong đối tượng: ảnh chụp kèm sơ đồ; tắt thì không kèm")
    void snapshotGraphOnlyWhenShown() {
        ApprovalProcess p = process("Quy trình", List.of(), branching());
        active(p);
        var hidden = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUALITATIVE), null, staff).orElseThrow();
        assertThat(hidden.snapshot()).doesNotContainKey("graph");
        p.setShowInObject(true);
        var shown = planner.plan(ApprovalSubjectType.CRITERIA, kpi(KpiType.QUALITATIVE), null, staff).orElseThrow();
        assertThat(shown.snapshot()).containsKey("graph");
    }
}
