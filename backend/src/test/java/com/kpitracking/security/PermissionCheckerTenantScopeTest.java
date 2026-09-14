package com.kpitracking.security;

import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.Permission;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitDelegationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Hồi quy cho lỗ hổng cross-tenant: quản trị viên tổ chức A không được đi qua kiểm tra quyền
 * trên dữ liệu của tổ chức B chỉ vì họ là "global admin" ở tổ chức của mình.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PermissionCheckerTenantScopeTest {

    @Mock UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    @Mock RolePermissionRepository rolePermissionRepository;
    @Mock OrgUnitRepository orgUnitRepository;
    @Mock UserRepository userRepository;
    @Mock OrgUnitDelegationRepository delegationRepository;

    PermissionChecker checker;

    // Hai tổ chức độc lập, mỗi bên một đơn vị gốc và một đơn vị con.
    Organization orgA, orgB;
    OrgUnit rootA, rootB, deptB;
    Role adminRoleA, staffRoleB, managerRoleA;
    User adminA, staffB, managerA;

    @BeforeEach
    void setUp() {
        checker = new PermissionChecker(userRoleOrgUnitRepository, rolePermissionRepository,
                orgUnitRepository, userRepository, delegationRepository);

        orgA = Organization.builder().id(UUID.randomUUID()).name("A").code("A").build();
        orgB = Organization.builder().id(UUID.randomUUID()).name("B").code("B").build();

        rootA = unit(orgA, null, "/A/");
        rootB = unit(orgB, null, "/B/");
        deptB = unit(orgB, rootB, "/B/HR/");

        adminRoleA = role(orgA, "GIÁM ĐỐC", 0);
        managerRoleA = role(orgA, "TRƯỞNG PHÒNG", 0);
        staffRoleB = role(orgB, "NHÂN VIÊN", 2);

        adminA = user("admin@a.vn");
        managerA = user("manager@a.vn");
        staffB = user("staff@b.vn");

        UserRoleOrgUnit adminAtRootA = assign(adminA, adminRoleA, rootA);
        UserRoleOrgUnit managerAtRootA = assign(managerA, managerRoleA, rootA);
        UserRoleOrgUnit staffAtDeptB = assign(staffB, staffRoleB, deptB);

        when(userRoleOrgUnitRepository.findByUserId(adminA.getId())).thenReturn(List.of(adminAtRootA));
        when(userRoleOrgUnitRepository.findByUserId(managerA.getId())).thenReturn(List.of(managerAtRootA));
        when(userRoleOrgUnitRepository.findByUserId(staffB.getId())).thenReturn(List.of(staffAtDeptB));

        when(rolePermissionRepository.findByRoleIdIn(any())).thenAnswer(inv -> {
            Collection<UUID> ids = inv.getArgument(0);
            java.util.List<RolePermission> out = new java.util.ArrayList<>();
            if (ids.contains(adminRoleA.getId())) out.add(perm(adminRoleA, "SYSTEM:ADMIN"));
            if (ids.contains(managerRoleA.getId())) out.add(perm(managerRoleA, "ORG:VIEW"));
            if (ids.contains(staffRoleB.getId())) out.add(perm(staffRoleB, "KPI:VIEW"));
            return out;
        });

        for (OrgUnit u : List.of(rootA, rootB, deptB)) {
            when(orgUnitRepository.findById(u.getId())).thenReturn(Optional.of(u));
        }
    }

    @Test
    void adminOfOrgA_isGlobalAdmin_butNotOverOrgB() {
        assertTrue(checker.isGlobalAdmin(adminA.getId()), "admin A vẫn là global admin của chính họ");

        assertTrue(checker.isGlobalAdminOfOrganization(adminA.getId(), orgA.getId()));
        assertFalse(checker.isGlobalAdminOfOrganization(adminA.getId(), orgB.getId()));

        assertTrue(checker.isGlobalAdminIn(adminA.getId(), rootA.getId()));
        assertFalse(checker.isGlobalAdminIn(adminA.getId(), rootB.getId()));
        assertFalse(checker.isGlobalAdminIn(adminA.getId(), deptB.getId()));

        assertFalse(checker.isGlobalAdminOverUser(adminA.getId(), staffB.getId()),
                "admin A không được quản lý user của org B");
    }

    @Test
    void nonAdmin_neverPassesAdminChecks() {
        assertFalse(checker.isGlobalAdmin(managerA.getId()));
        assertFalse(checker.isGlobalAdminOfOrganization(managerA.getId(), orgA.getId()));
        assertFalse(checker.isGlobalAdminIn(managerA.getId(), rootA.getId()));
        assertFalse(checker.isGlobalAdminOverUser(managerA.getId(), staffB.getId()));
    }

    @Test
    void hasPermissionInOrganization_onlyCountsRolesInsideThatOrg() {
        // Quyền ORG:VIEW của manager A chỉ có giá trị ở org A.
        assertTrue(checker.hasPermissionInOrganization(managerA.getId(), "ORG:VIEW", orgA.getId()));
        assertFalse(checker.hasPermissionInOrganization(managerA.getId(), "ORG:VIEW", orgB.getId()));

        // SYSTEM:ADMIN thay được mọi quyền — nhưng cũng chỉ trong org của mình.
        assertTrue(checker.hasPermissionInOrganization(adminA.getId(), "WALLET:VIEW", orgA.getId()));
        assertFalse(checker.hasPermissionInOrganization(adminA.getId(), "WALLET:VIEW", orgB.getId()));

        // Trong khi hasPermission (toàn cục) vẫn trả true — đó chính là lý do không dùng nó cho resource theo id.
        assertTrue(checker.hasPermission(managerA.getId(), "ORG:VIEW"));
    }

    @Test
    void membership_isPerOrganization() {
        assertTrue(checker.isMemberOfOrganization(staffB.getId(), orgB.getId()));
        assertFalse(checker.isMemberOfOrganization(staffB.getId(), orgA.getId()));
        assertFalse(checker.isMemberOfOrganization(staffB.getId(), null));
    }

    @Test
    void orphanUser_isStillManageableByAnyAdmin() {
        User orphan = user("new@nowhere.vn");
        when(userRoleOrgUnitRepository.findByUserId(orphan.getId())).thenReturn(List.of());

        assertTrue(checker.isGlobalAdminOverUser(adminA.getId(), orphan.getId()),
                "người chưa vào đơn vị nào không thuộc tenant nào để đối chiếu");
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static OrgUnit unit(Organization org, OrgUnit parent, String path) {
        OrgHierarchyLevel level = OrgHierarchyLevel.builder()
                .id(UUID.randomUUID()).organization(org).levelOrder(parent == null ? 0 : 1).build();
        return OrgUnit.builder().id(UUID.randomUUID()).parent(parent)
                .orgHierarchyLevel(level).path(path).name(path).code(path).build();
    }

    private static Role role(Organization org, String name, int rank) {
        return Role.builder().id(UUID.randomUUID()).organization(org).name(name).rank(rank).level(0).build();
    }

    private static User user(String email) {
        return User.builder().id(UUID.randomUUID()).email(email).fullName(email).build();
    }

    private static UserRoleOrgUnit assign(User u, Role r, OrgUnit unit) {
        return UserRoleOrgUnit.builder().user(u).role(r).orgUnit(unit).build();
    }

    private static RolePermission perm(Role role, String code) {
        Permission p = Permission.builder().id(UUID.randomUUID()).code(code).build();
        return RolePermission.builder().role(role).permission(p).build();
    }
}
