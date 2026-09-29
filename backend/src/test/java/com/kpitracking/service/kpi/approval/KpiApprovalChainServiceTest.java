package com.kpitracking.service.kpi.approval;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Luật duyệt của chuỗi trên cây mẫu: Phòng A ⊂ Khối B ⊂ Công ty C (gốc).
 * Nhân viên thuộc Phòng A; trưởng A, trưởng B, giám đốc C; admin là người có SYSTEM:ADMIN ở gốc.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KpiApprovalChainServiceTest {

    @Mock KpiApprovalFlowRepository flowRepository;
    @Mock KpiApprovalEventRepository eventRepository;
    @Mock KpiApprovalStepRepository stepRepository;
    @Mock UserRoleOrgUnitRepository uroRepository;
    @Mock RolePermissionRepository rolePermissionRepository;
    @Mock OrgUnitRepository orgUnitRepository;
    @Mock UserRepository userRepository;
    @Mock PermissionChecker permissionChecker;
    @Mock KpiWorkflowConfigService workflowConfigService;
    @Mock CycleStatusGuard cycleStatusGuard;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock EntityManager entityManager;

    private KpiApprovalChainService service;

    private final UUID orgId = UUID.randomUUID();
    private OrgUnit unitA, unitB, unitC;
    private User staff, headA, headB, headC, admin;
    private Role managerRole, adjustOnlyRole;
    private final Map<UUID, KpiApprovalFlow> saved = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new KpiApprovalChainService(flowRepository, eventRepository, stepRepository, uroRepository,
                rolePermissionRepository, orgUnitRepository, userRepository, permissionChecker,
                workflowConfigService, cycleStatusGuard, eventPublisher, entityManager);

        Organization org = Organization.builder().id(orgId).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().id(UUID.randomUUID()).organization(org).build();
        unitC = OrgUnit.builder().id(UUID.randomUUID()).name("Công ty C").path("/c/").orgHierarchyLevel(level).build();
        unitB = OrgUnit.builder().id(UUID.randomUUID()).name("Khối B").path("/c/b/").parent(unitC).orgHierarchyLevel(level).build();
        unitA = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng A").path("/c/b/a/").parent(unitB).orgHierarchyLevel(level).build();

        staff = user("Nhân viên");
        headA = user("Trưởng A");
        headB = user("Trưởng B");
        headC = user("Giám đốc C");
        admin = user("Quản trị");

        managerRole = Role.builder().id(UUID.randomUUID()).name("Trưởng").rank(0).build();
        Permission approveCriteria = Permission.builder().id(UUID.randomUUID()).code("KPI:APPROVE_CRITERIA").build();
        Permission approveAdjustment = Permission.builder().id(UUID.randomUUID()).code("KPI:APPROVE_ADJUSTMENT").build();
        adjustOnlyRole = Role.builder().id(UUID.randomUUID()).name("Trưởng chỉ duyệt điều chỉnh").rank(0).build();
        when(rolePermissionRepository.findByRoleIdIn(any())).thenReturn(List.of(
                RolePermission.builder().role(managerRole).permission(approveCriteria).build(),
                RolePermission.builder().role(managerRole).permission(approveAdjustment).build(),
                RolePermission.builder().role(adjustOnlyRole).permission(approveAdjustment).build()));

        heads(unitA, headA);
        heads(unitB, headB);
        heads(unitC, headC);

        when(workflowConfigService.definitionFor(any()))
                .thenReturn(new WorkflowDefinitionFactory(new StageRegistry()).buildDefault());
        when(flowRepository.findRunningId(any(), any())).thenReturn(Optional.empty());
        when(flowRepository.findRunningIdByAdjustment(any())).thenReturn(Optional.empty());
        when(flowRepository.save(any(KpiApprovalFlow.class))).thenAnswer(inv -> {
            KpiApprovalFlow f = inv.getArgument(0);
            if (f.getId() == null) f.setId(UUID.randomUUID());
            f.getSteps().forEach(s -> { if (s.getId() == null) s.setId(UUID.randomUUID()); });
            saved.put(f.getId(), f);
            return f;
        });
        when(entityManager.find(eq(KpiApprovalFlow.class), any(), any(jakarta.persistence.LockModeType.class))).thenAnswer(inv -> saved.get((UUID) inv.getArgument(1)));
        when(orgUnitRepository.findRootsByOrganizationId(orgId)).thenReturn(List.of(unitC));
        when(uroRepository.findUsersWithPermissionInOrgUnit(unitC.getId(), "SYSTEM:ADMIN")).thenReturn(List.of(admin));
        when(permissionChecker.isGlobalAdminIn(eq(admin.getId()), any())).thenReturn(true);
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).fullName(name).email(name + "@x").status(UserStatus.ACTIVE).build();
    }

    private void heads(OrgUnit unit, User... users) {
        heads(unit, managerRole, users);
    }

    private void heads(OrgUnit unit, Role role, User... users) {
        List<UserRoleOrgUnit> list = Arrays.stream(users)
                .map(u -> UserRoleOrgUnit.builder().user(u).role(role).orgUnit(unit).build()).toList();
        when(uroRepository.findByOrgUnitIdAndRoleRank(unit.getId(), 0)).thenReturn(list);
    }

    private void grantFinal(User u, boolean on) {
        when(permissionChecker.hasRolePermissionInOrgUnit(eq(u.getId()), eq(KpiApprovalChainService.PERM_FINAL), any()))
                .thenReturn(on);
    }

    private KpiCriteria kpi(User creator) {
        return KpiCriteria.builder().id(UUID.randomUUID()).name("Doanh thu").orgUnit(unitA)
                .createdBy(creator).status(KpiStatus.PENDING_APPROVAL).build();
    }

    private KpiApprovalFlow submit(KpiCriteria kpi, User requester) {
        return service.startCriteria(kpi, requester, ApprovalEventAction.SUBMITTED, true).flow();
    }

    private ApprovalOutcome approve(KpiApprovalFlow flow, User actor) {
        var d = service.authorize(flow.getId(), actor, flow.currentStep().orElseThrow().getId());
        return service.approve(d, actor, null);
    }

    private static List<ApprovalStepStatus> statuses(KpiApprovalFlow f) {
        return f.getSteps().stream().map(KpiApprovalStep::getStatus).toList();
    }

    @Test
    @DisplayName("Test 1: không ai có quyền duyệt cuối ⇒ đi đủ 3 bước; cấp trên chưa tới lượt khi cấp dưới chưa duyệt")
    void threeStepsWithoutFinalPermission() {
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.PENDING, ApprovalStepStatus.WAITING, ApprovalStepStatus.WAITING);
        // Cấp trên chưa giữ bước hiện tại ⇒ không nằm trong hộp chờ và không thao tác được.
        assertThatThrownBy(() -> service.authorize(flow.getId(), headB, null)).isInstanceOf(ForbiddenException.class);

        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(flow.currentStep().orElseThrow().isHeldBy(headB.getId())).isTrue();
        assertThat(approve(flow, headB)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(approve(flow, headC)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(flow.getStatus()).isEqualTo(ApprovalFlowStatus.APPROVED);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.APPROVED_FORWARDED,
                ApprovalStepStatus.APPROVED_FORWARDED, ApprovalStepStatus.APPROVED_FINAL);
    }

    @Test
    @DisplayName("Test 2: vai trò cấp 1 có KPI:APPROVE_FINAL ⇒ duyệt xong là chốt, cấp 2–3 bị bỏ qua do uỷ quyền")
    void level1HasFinalPermission() {
        grantFinal(headA, true);
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(flow.getStatus()).isEqualTo(ApprovalFlowStatus.APPROVED);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.APPROVED_FINAL,
                ApprovalStepStatus.SKIPPED_DELEGATED, ApprovalStepStatus.SKIPPED_DELEGATED);
        // Không còn bước đang chờ ⇒ cấp 2–3 không thấy trong hộp chờ.
        assertThat(flow.currentStep()).isEmpty();
    }

    @Test
    @DisplayName("Test 3: trưởng khối có quyền duyệt cuối ⇒ chốt được KPI của nhân viên ở phòng con")
    void blockHeadFinalOverChildUnit() {
        // Quyền kiểm theo ĐƠN VỊ CỦA KPI (Phòng A, con của Khối B) — PermissionChecker thật tính kế thừa theo path.
        when(permissionChecker.hasRolePermissionInOrgUnit(headB.getId(), KpiApprovalChainService.PERM_FINAL, unitA.getId()))
                .thenReturn(true);
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        approve(flow, headA);
        assertThat(approve(flow, headB)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.APPROVED_FORWARDED,
                ApprovalStepStatus.APPROVED_FINAL, ApprovalStepStatus.SKIPPED_DELEGATED);
    }

    @Test
    @DisplayName("Test 4: admin tắt quyền của vai trò khi KPI đang chờ ⇒ lần bấm chỉ chuyển lên cấp trên")
    void permissionRevokedWhilePending() {
        grantFinal(headA, true);
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        grantFinal(headA, false); // tắt sau khi đã gửi — quyền kiểm lúc bấm
        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(flow.getStatus()).isEqualTo(ApprovalFlowStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("Test 5: từ chối ở cấp 2 ⇒ flow kết thúc; gửi lại chạy chuỗi mới từ cấp 1")
    void rejectAtLevel2ThenResubmit() {
        KpiCriteria k = kpi(staff);
        KpiApprovalFlow first = submit(k, staff);
        approve(first, headA);
        var d = service.authorize(first.getId(), headB, null);
        assertThatThrownBy(() -> service.reject(d, headB, " ")).extracting("errorCode").isEqualTo(ErrorCode.ENTER_REJECTION_REASON);
        service.reject(d, headB, "Mục tiêu quá thấp");
        assertThat(first.getStatus()).isEqualTo(ApprovalFlowStatus.REJECTED);
        assertThat(statuses(first)).containsExactly(ApprovalStepStatus.APPROVED_FORWARDED,
                ApprovalStepStatus.REJECTED, ApprovalStepStatus.CANCELLED);

        when(flowRepository.countByKpiCriteriaIdAndSubjectType(k.getId(), ApprovalSubjectType.CRITERIA)).thenReturn(1L);
        KpiApprovalFlow second = submit(k, staff);
        assertThat(second.getRound()).isEqualTo(2);
        assertThat(second.currentStep().orElseThrow().isHeldBy(headA.getId())).isTrue();
    }

    @Test
    @DisplayName("Test 6: người có quyền duyệt cuối không tự duyệt được KPI của chính mình")
    void finalApproverCannotApproveOwn() {
        grantFinal(headA, true);
        KpiApprovalFlow flow = submit(kpi(headA), headA);
        // Chuỗi bắt đầu từ cấp trên của trưởng A; trưởng A không giữ bước nào.
        assertThat(flow.getSteps()).noneMatch(s -> s.isHeldBy(headA.getId()));
        assertThatThrownBy(() -> service.authorize(flow.getId(), headA, null)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("Test 7: người không giữ bước gọi thẳng API ⇒ 403; admin cũng không được duyệt thay")
    void nonHolderAndAdminCannotAct() {
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        assertThatThrownBy(() -> service.authorize(flow.getId(), headC, null))
                .isInstanceOf(ForbiddenException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_HOLDER_APPROVAL_STEP);
        assertThatThrownBy(() -> service.authorize(flow.getId(), admin, null))
                .isInstanceOf(ForbiddenException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ADMINISTRATORS_MAY_ONLY_REASSIGN_APPROVER_NOT_APPROVE);
    }

    @Test
    @DisplayName("Test 10 (lớp logic): bước đã đổi so với lúc người dùng xem ⇒ 409")
    void staleExpectedStep() {
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        UUID seen = flow.currentStep().orElseThrow().getId();
        approve(flow, headA);
        assertThatThrownBy(() -> service.authorize(flow.getId(), headB, seen)).isInstanceOf(StaleStateException.class);
    }

    @Test
    @DisplayName("Test 9: xin điều chỉnh đi đúng chuỗi (theo quyền duyệt điều chỉnh) và đúng luật duyệt cuối")
    void adjustmentFollowsChain() {
        // Trưởng B chỉ có quyền duyệt điều chỉnh: vẫn là một bước của chuỗi điều chỉnh.
        heads(unitB, adjustOnlyRole, headB);
        KpiCriteria k = kpi(headA);
        KpiAdjustmentRequest adj = KpiAdjustmentRequest.builder().id(UUID.randomUUID()).kpiCriteria(k).requester(staff).build();
        KpiApprovalFlow flow = service.startAdjustment(adj, staff, ApprovalEventAction.SUBMITTED, true).flow();
        assertThat(flow.getSubjectType()).isEqualTo(ApprovalSubjectType.ADJUSTMENT);
        assertThat(flow.getSteps()).extracting(KpiApprovalStep::getOrgUnitName)
                .containsExactly("Phòng A", "Khối B", "Công ty C");

        grantFinal(headB, true);
        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(approve(flow, headB)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(statuses(flow).get(2)).isEqualTo(ApprovalStepStatus.SKIPPED_DELEGATED);
    }

    @Test
    @DisplayName("C3: giám đốc (trưởng gốc) có KPI:APPROVE_OWN ⇒ tự duyệt; không có ⇒ chuyển admin")
    void topCreator() {
        when(permissionChecker.hasPermission(headC.getId(), "KPI:APPROVE_OWN")).thenReturn(true);
        var result = service.startCriteria(kpi(headC), headC, ApprovalEventAction.SUBMITTED, true);
        assertThat(result.selfApproved()).isTrue();

        when(permissionChecker.hasPermission(headC.getId(), "KPI:APPROVE_OWN")).thenReturn(false);
        var toAdmin = service.startCriteria(kpi(headC), headC, ApprovalEventAction.SUBMITTED, true);
        assertThat(toAdmin.selfApproved()).isFalse();
        KpiApprovalStep step = toAdmin.flow().currentStep().orElseThrow();
        assertThat(step.getKind()).isEqualTo(ApprovalStepKind.ADMIN_FALLBACK);
        assertThat(step.isHeldBy(admin.getId())).isTrue();
        // Admin là người giữ bước ⇒ duyệt bình thường (ngoại lệ của C9).
        assertThat(approve(toAdmin.flow(), admin)).isEqualTo(ApprovalOutcome.FINAL);
    }

    @Test
    @DisplayName("Người có KPI:APPROVE_OWN (không phải cấp cao nhất) gửi duyệt ⇒ chốt ngay, không lập chuỗi")
    void selfApproveOwnerSkipsChain() {
        when(permissionChecker.hasPermission(headA.getId(), "KPI:APPROVE_OWN")).thenReturn(true);
        var result = service.startCriteria(kpi(headA), headA, ApprovalEventAction.SUBMITTED, true);
        assertThat(result.selfApproved()).isTrue();
        assertThat(result.flow().getStatus()).isEqualTo(ApprovalFlowStatus.APPROVED);
        assertThat(result.flow().getSteps()).isEmpty();

        // Điều chỉnh vẫn luôn đi chuỗi, kể cả khi người xin có quyền tự duyệt.
        KpiAdjustmentRequest adj = KpiAdjustmentRequest.builder().id(UUID.randomUUID()).kpiCriteria(kpi(headA)).requester(headA).build();
        assertThat(service.startAdjustment(adj, headA, ApprovalEventAction.SUBMITTED, true).selfApproved()).isFalse();
    }

    @Test
    @DisplayName("C5: người duyệt bị vô hiệu hoá ⇒ tự chuyển lên cấp trên")
    void deactivatedApproverEscalates() {
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        when(flowRepository.findRunningIdsHeldBy(headA.getId())).thenReturn(List.of(flow.getId()));
        service.onApproverDeactivated(headA);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.SKIPPED_INACTIVE,
                ApprovalStepStatus.PENDING, ApprovalStepStatus.WAITING);
        assertThat(flow.currentStep().orElseThrow().isHeldBy(headB.getId())).isTrue();
    }

    @Test
    @DisplayName("Admin gán lại người duyệt của bước đang chờ; không gán được cho chính người gửi")
    void adminReassigns() {
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        KpiApprovalStep step = flow.currentStep().orElseThrow();
        when(stepRepository.findFlowIdByStepId(step.getId())).thenReturn(Optional.of(flow.getId()));
        when(flowRepository.findById(flow.getId())).thenReturn(Optional.of(flow));
        when(permissionChecker.isMemberOfOrganization(any(), eq(orgId))).thenReturn(true);
        User other = user("Trưởng A mới");
        when(userRepository.findById(other.getId())).thenReturn(Optional.of(other));
        when(userRepository.findById(staff.getId())).thenReturn(Optional.of(staff));

        assertThatThrownBy(() -> service.reassign(step.getId(), headB, other.getId(), "x"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.reassign(step.getId(), admin, staff.getId(), "x"))
                .extracting("errorCode").isEqualTo(ErrorCode.SUBMITTER_CANNOT_ASSIGNED_APPROVER_THEIR_OWN_REQUEST);

        service.reassign(step.getId(), admin, other.getId(), "Trưởng A nghỉ phép dài");
        assertThat(flow.currentStep().orElseThrow().isHeldBy(other.getId())).isTrue();
        assertThat(approve(flow, other)).isEqualTo(ApprovalOutcome.FORWARDED);
    }
}
