package com.kpitracking.service.kpi.approval;

import com.kpitracking.exception.ErrorCode;


import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.StaleStateException;

import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.approvalprocess.ApprovalProcessPlanner;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.ParameterizedTest;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kpitracking.entity.access.Permission;
import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.access.RolePermission;
import com.kpitracking.entity.kpi.KpiAdjustmentRequest;
import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.kpi.KpiApprovalStep;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.OrgHierarchyLevel;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.kpi.ApprovalEventAction;
import com.kpitracking.enums.kpi.ApprovalFlowStatus;
import com.kpitracking.enums.kpi.ApprovalOutcome;
import com.kpitracking.enums.kpi.ApprovalStepKind;
import com.kpitracking.enums.kpi.ApprovalStepStatus;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.enums.kpi.KpiStatus;
import com.kpitracking.enums.organization.OrgUnitRelationType;
import com.kpitracking.enums.user.UserStatus;
import com.kpitracking.repository.access.RolePermissionRepository;
import com.kpitracking.repository.kpi.KpiApprovalEventRepository;
import com.kpitracking.repository.kpi.KpiApprovalFlowRepository;
import com.kpitracking.repository.kpi.KpiApprovalStepRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
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
    @Mock ApprovalProcessPlanner processPlanner;

    private KpiApprovalChainService service;

    private final UUID orgId = UUID.randomUUID();
    private OrgUnit unitA, unitB, unitC;
    private User staff, headA, headB, headC, admin;
    private Role managerRole, adjustOnlyRole;
    private final Map<UUID, KpiApprovalFlow> saved = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new KpiApprovalChainService(flowRepository, eventRepository,
                mock(com.kpitracking.service.discussion.KpiDiscussionTimeline.class), stepRepository, uroRepository,
                rolePermissionRepository, orgUnitRepository, userRepository, permissionChecker,
                workflowConfigService, cycleStatusGuard, eventPublisher, entityManager, processPlanner);
        when(processPlanner.plan(any(), any(), any(), any())).thenReturn(Optional.empty());

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

    @ParameterizedTest
    @EnumSource(value = com.kpitracking.enums.organization.OrgUnitRelationType.class, names = {"ADVISORY", "SUPERVISORY"})
    @DisplayName("Quan hệ tham mưu/giám sát CHỈ để vẽ sơ đồ: chuỗi duyệt vẫn đi lên đơn vị cha như trực tuyến")
    void sideRelationStillFollowsParentChain(com.kpitracking.enums.organization.OrgUnitRelationType relation) {
        unitA.setParentRelation(relation);
        unitB.setParentRelation(relation);

        KpiApprovalFlow flow = submit(kpi(staff), staff);

        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.PENDING, ApprovalStepStatus.WAITING, ApprovalStepStatus.WAITING);
        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(flow.currentStep().orElseThrow().isHeldBy(headB.getId())).isTrue();
        assertThat(approve(flow, headB)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(approve(flow, headC)).isEqualTo(ApprovalOutcome.FINAL);
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

    private ApprovalProcessPlanner.ProcessPlan processPlan(ApprovalProcessPlanner.PlannedStep... steps) {
        return new ApprovalProcessPlanner.ProcessPlan(UUID.randomUUID(), "Duyệt KPI định tính", List.of(steps),
                Map.of("showInObject", false, "pathNodeIds", List.of("start", "s1", "s2")));
    }

    private static ApprovalProcessPlanner.PlannedStep processStep(String code, String name, User... holders) {
        return new ApprovalProcessPlanner.PlannedStep("node-" + code, code, name,
                Arrays.stream(holders).map(u -> new ApprovalProcessPlanner.Holder(u.getId(), u.getFullName())).toList(),
                holders.length == 0 ? ApprovalProcessPlanner.REASON_NO_APPROVER : null);
    }

    @Test
    @DisplayName("Có quy trình khớp ⇒ bước lấy theo quy trình (tên, mã, người giữ) thay cho chuỗi trưởng đơn vị")
    void processStepsReplaceUnitHeads() {
        when(processPlanner.plan(eq(ApprovalSubjectType.CRITERIA), any(), any(), any())).thenReturn(Optional.of(
                processPlan(processStep("1", "Giám đốc duyệt", headC), processStep("2", "Trưởng B xác nhận", headB))));
        KpiApprovalFlow flow = submit(kpi(staff), staff);

        assertThat(flow.getProcessTitle()).isEqualTo("Duyệt KPI định tính");
        assertThat(flow.getSteps()).extracting(KpiApprovalStep::getKind)
                .containsOnly(ApprovalStepKind.PROCESS_STEP);
        assertThat(flow.getSteps()).extracting(KpiApprovalStep::displayName)
                .containsExactly("1 · Giám đốc duyệt", "2 · Trưởng B xác nhận");
        assertThat(flow.currentStep().orElseThrow().isHeldBy(headC.getId())).isTrue();

        assertThat(approve(flow, headC)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThat(approve(flow, headB)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(flow.getStatus()).isEqualTo(ApprovalFlowStatus.APPROVED);
        verify(eventPublisher).publishEvent(any(com.kpitracking.event.ApprovalChainEvents.ProcessFlowStarted.class));
        verify(eventPublisher).publishEvent(any(com.kpitracking.event.ApprovalChainEvents.ProcessFlowFinished.class));
    }

    @Test
    @DisplayName("Bước quy trình không còn ai giữ bị bỏ qua; hết bước thao tác được thì chuyển admin")
    void processWithoutApproverFallsBackToAdmin() {
        when(processPlanner.plan(any(), any(), any(), any())).thenReturn(Optional.of(
                processPlan(processStep("1", "Bước trống"))));
        KpiApprovalFlow flow = submit(kpi(staff), staff);
        assertThat(statuses(flow)).containsExactly(ApprovalStepStatus.SKIPPED_NO_HEAD, ApprovalStepStatus.PENDING);
        assertThat(flow.getSteps().get(1).getKind()).isEqualTo(ApprovalStepKind.ADMIN_FALLBACK);
        assertThat(flow.currentStep().orElseThrow().isHeldBy(admin.getId())).isTrue();
    }

    // ── Đối tượng khác KPI (bài nộp kết quả) ──

    private KpiApprovalChainService.Subject submissionSubject(UUID id) {
        return new KpiApprovalChainService.Subject(ApprovalSubjectType.SUBMISSION, id, "Doanh thu", unitA, null, null);
    }

    @Test
    @DisplayName("Đối tượng khác KPI không có quy trình khớp ⇒ không mở flow (giữ luật duyệt cũ), không lui về chuỗi trưởng đơn vị")
    void subjectWithoutProcessOpensNoFlow() {
        when(processPlanner.plan(any(), any(), any())).thenReturn(Optional.empty());
        assertThat(service.startSubject(submissionSubject(UUID.randomUUID()), staff, true)).isEmpty();
        verify(flowRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    @DisplayName("Bài nộp đi đủ các bước quy trình: KPI:APPROVE_FINAL không cho duyệt vượt bước như với chỉ tiêu")
    void subjectFollowsEveryProcessStep() {
        when(processPlanner.plan(any(), any(), any())).thenReturn(Optional.of(
                processPlan(processStep("1", "Trưởng A duyệt", headA), processStep("2", "Giám đốc duyệt", headC))));
        when(flowRepository.findRunningIdBySubject(any(), any())).thenReturn(Optional.empty());
        grantFinal(headA, true);
        UUID submissionId = UUID.randomUUID();

        KpiApprovalFlow flow = service.startSubject(submissionSubject(submissionId), staff, true).orElseThrow();
        assertThat(flow.getSubjectId()).isEqualTo(submissionId);
        assertThat(flow.getKpiCriteria()).isNull();
        assertThat(flow.unit()).isEqualTo(unitA);

        assertThat(approve(flow, headA)).isEqualTo(ApprovalOutcome.FORWARDED);
        assertThatThrownBy(() -> approve(flow, headA)).isInstanceOf(ForbiddenException.class);
        assertThat(approve(flow, headC)).isEqualTo(ApprovalOutcome.FINAL);
        assertThat(flow.getStatus()).isEqualTo(ApprovalFlowStatus.APPROVED);
    }

    @Test
    @DisplayName("Gửi lại bài nộp: flow cũ đang chạy bị huỷ trước khi mở flow mới")
    void resubmittingSubjectCancelsRunningFlow() {
        when(processPlanner.plan(any(), any(), any())).thenReturn(Optional.of(
                processPlan(processStep("1", "Trưởng A duyệt", headA))));
        UUID submissionId = UUID.randomUUID();
        when(flowRepository.findRunningIdBySubject(any(), any())).thenReturn(Optional.empty());
        KpiApprovalFlow first = service.startSubject(submissionSubject(submissionId), staff, true).orElseThrow();

        when(flowRepository.findRunningIdBySubject(ApprovalSubjectType.SUBMISSION, submissionId))
                .thenReturn(Optional.of(first.getId()));
        KpiApprovalFlow second = service.startSubject(submissionSubject(submissionId), staff, true).orElseThrow();

        assertThat(first.getStatus()).isEqualTo(ApprovalFlowStatus.CANCELLED);
        assertThat(second.getStatus()).isEqualTo(ApprovalFlowStatus.IN_PROGRESS);
    }
}
