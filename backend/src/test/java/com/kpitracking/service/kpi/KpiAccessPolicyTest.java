package com.kpitracking.service.kpi;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiApprovalStepRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Luật xem KPI dùng chung (KpiAccessPolicy) — không cần DB. */
class KpiAccessPolicyTest {

    private final PermissionChecker permissionChecker = mock(PermissionChecker.class);
    private final UserRoleOrgUnitRepository uroRepository = mock(UserRoleOrgUnitRepository.class);
    private final KpiApprovalStepRepository stepRepository = mock(KpiApprovalStepRepository.class);
    private final KpiAccessPolicy policy = new KpiAccessPolicy(permissionChecker, uroRepository, stepRepository, null);

    private final UUID creator = UUID.randomUUID();
    private final UUID assignee = UUID.randomUUID();
    private final UUID stranger = UUID.randomUUID();
    private OrgUnit root, dept, team, otherDept;

    @BeforeEach
    void setUp() {
        root = unit("/KPC/");
        dept = unit("/KPC/d1/");
        team = unit("/KPC/d1/t1/");
        otherDept = unit("/KPC/d2/");
        when(stepRepository.isChainViewer(any(), any())).thenReturn(false);
    }

    private static OrgUnit unit(String path) {
        OrgUnit u = new OrgUnit();
        u.setId(UUID.randomUUID());
        u.setPath(path);
        return u;
    }

    private KpiCriteria kpi(KpiStatus status) {
        User c = new User(); c.setId(creator);
        User a = new User(); a.setId(assignee);
        return KpiCriteria.builder().id(UUID.randomUUID()).orgUnit(team).status(status)
                .createdBy(c).assignees(List.of(a)).build();
    }

    private KpiAccessPolicy.Viewer manager(OrgUnit of) {
        return new KpiAccessPolicy.Viewer(stranger, false, List.of(of.getPath()), List.of(of.getId()), List.of());
    }

    private KpiAccessPolicy.Viewer member(OrgUnit of) {
        return new KpiAccessPolicy.Viewer(stranger, false, List.of(), List.of(), List.of(of.getId()));
    }

    private KpiAccessPolicy.Viewer nobody(UUID id) {
        return new KpiAccessPolicy.Viewer(id, false, List.of(), List.of(), List.of());
    }

    @Test
    void creatorAndAssigneeSeeEveryStatusIncludingDraft() {
        for (KpiStatus s : KpiStatus.values()) {
            assertThat(policy.canView(nobody(creator), kpi(s))).isTrue();
            assertThat(policy.canView(nobody(assignee), kpi(s))).isTrue();
        }
    }

    @Test
    void ancestorManagerSeesOnlyApprovedRunningKpis() {
        // Cấp trên không thấy KPI còn đang chờ ở bước dưới (luật chuỗi duyệt).
        assertThat(policy.canView(manager(root), kpi(KpiStatus.PENDING_APPROVAL))).isFalse();
        assertThat(policy.canView(manager(team), kpi(KpiStatus.REJECTED))).isFalse();
        assertThat(policy.canView(manager(dept), kpi(KpiStatus.DRAFT))).isFalse();
        assertThat(policy.canView(manager(dept), kpi(KpiStatus.APPROVED))).isTrue();
        // Đang xin điều chỉnh / đã điều chỉnh vẫn là KPI đang chạy.
        assertThat(policy.canView(manager(root), kpi(KpiStatus.EDIT))).isTrue();
        assertThat(policy.canView(manager(root), kpi(KpiStatus.EDITED))).isTrue();
    }

    @Test
    void sideRelationIsDisplayOnlyAncestorManagerStillSees() {
        // Quan hệ tham mưu / giám sát chỉ để vẽ sơ đồ: trưởng-phó đơn vị tổ tiên vẫn thấy như trực tuyến.
        for (var relation : com.kpitracking.enums.OrgUnitRelationType.values()) {
            team.setParentRelation(relation);
            dept.setParentRelation(relation);
            assertThat(policy.canView(manager(root), kpi(KpiStatus.APPROVED))).as(relation.name()).isTrue();
            assertThat(policy.canView(manager(dept), kpi(KpiStatus.APPROVED))).as(relation.name()).isTrue();
            assertThat(policy.canView(manager(root), kpi(KpiStatus.PENDING_APPROVAL))).as(relation.name()).isFalse();
        }
    }

    @Test
    void managerOfSiblingUnitDoesNotSee() {
        assertThat(policy.canView(manager(otherDept), kpi(KpiStatus.APPROVED))).isFalse();
    }

    @Test
    void sameUnitMemberSeesOnlyApproved() {
        assertThat(policy.canView(member(team), kpi(KpiStatus.APPROVED))).isTrue();
        assertThat(policy.canView(member(team), kpi(KpiStatus.PENDING_APPROVAL))).isFalse();
        // Nhân viên của đơn vị cha không phải cấp trên.
        assertThat(policy.canView(member(dept), kpi(KpiStatus.APPROVED))).isFalse();
    }

    @Test
    void adminSeesAllButDraft() {
        KpiAccessPolicy.Viewer admin = new KpiAccessPolicy.Viewer(stranger, true, List.of(), List.of(), List.of());
        assertThat(policy.canView(admin, kpi(KpiStatus.EDIT))).isTrue();
        assertThat(policy.canView(admin, kpi(KpiStatus.DRAFT))).isFalse();
    }

    @Test
    void currentStepHolderOrPastApproverSeesKpiButNeverDraft() {
        KpiCriteria k = kpi(KpiStatus.PENDING_APPROVAL);
        when(stepRepository.isChainViewer(k.getId(), stranger)).thenReturn(true);
        assertThat(policy.canView(nobody(stranger), k)).isTrue();

        KpiCriteria draft = kpi(KpiStatus.DRAFT);
        when(stepRepository.isChainViewer(draft.getId(), stranger)).thenReturn(true);
        assertThat(policy.canView(nobody(stranger), draft)).isFalse();
    }

    @Test
    void viewerSplitsManagerAndMemberAssignments() {
        Role head = new Role(); head.setRank(0);
        Role staff = new Role(); staff.setRank(2);
        UserRoleOrgUnit a1 = new UserRoleOrgUnit(); a1.setRole(head); a1.setOrgUnit(dept);
        UserRoleOrgUnit a2 = new UserRoleOrgUnit(); a2.setRole(staff); a2.setOrgUnit(root);
        when(uroRepository.findByUserId(stranger)).thenReturn(List.of(a1, a2));

        KpiAccessPolicy.Viewer v = policy.viewer(stranger, null);
        assertThat(v.managerUnitPaths()).containsExactly(dept.getPath());
        assertThat(v.memberUnitIds()).containsExactly(root.getId());
        assertThat(v.admin()).isFalse();
        assertThat(policy.canView(v, kpi(KpiStatus.APPROVED))).isTrue();
    }
}
