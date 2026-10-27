package com.kpitracking.service;

import com.kpitracking.service.user.UserService;

import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Luật chọn đơn vị chính ({@link PrimaryUnitResolver#pick}) — không cần DB. */
class PrimaryUnitResolverTest {

    private final OrgUnit root = unit("/r/");
    private final OrgUnit dept = unit("/r/d/");
    private final OrgUnit team = unit("/r/d/t/");
    private final OrgUnit otherDept = unit("/r/o/");
    private final Role head = role(0), deputy = role(1), staff = role(2);
    private final User user = User.builder().id(UUID.randomUUID()).build();

    @Test
    void autoParentStaffRow_doesNotPullPersonUpToParent() {
        // UserService tự sinh dòng nhân viên ở đơn vị cha: cùng rank ⇒ đơn vị sâu hơn thắng.
        assertThat(PrimaryUnitResolver.pick(List.of(row(dept, staff), row(team, staff)), null).getOrgUnit())
                .isEqualTo(team);
    }

    @Test
    void headRole_beatsDeeperStaffMembership() {
        // Trưởng phòng kiêm nhân viên một team ở phòng khác vẫn "ở" phòng mình.
        assertThat(PrimaryUnitResolver.pick(List.of(row(team, staff), row(otherDept, head)), null).getOrgUnit())
                .isEqualTo(otherDept);
    }

    @Test
    void pinnedUnit_winsWhileStillMember_elseFallback() {
        List<UserRoleOrgUnit> rows = List.of(row(team, staff), row(otherDept, head));
        assertThat(PrimaryUnitResolver.pick(rows, team.getId()).getOrgUnit()).isEqualTo(team);
        // Cột trỏ vào đơn vị đã rời ⇒ không dùng nữa.
        assertThat(PrimaryUnitResolver.pick(rows, root.getId()).getOrgUnit()).isEqualTo(otherDept);
    }

    @Test
    void severalRolesInOneUnit_returnsHighestRoleThere() {
        List<UserRoleOrgUnit> rows = List.of(row(dept, staff), row(dept, head), row(dept, deputy));
        UserRoleOrgUnit p = PrimaryUnitResolver.pick(rows, dept.getId());
        assertThat(p.getOrgUnit()).isEqualTo(dept);
        assertThat(p.getRole()).isEqualTo(head);
        assertThat(PrimaryUnitResolver.pick(rows, null).getRole()).isEqualTo(head);
    }

    @Test
    void delegationLeaderRole_neverBecomesPrimary_unlessOnlyRow() {
        UserRoleOrgUnit delegated = row(otherDept, head);
        delegated.setDelegationId(UUID.randomUUID());
        assertThat(PrimaryUnitResolver.pick(List.of(row(team, staff), delegated), otherDept.getId()).getOrgUnit())
                .isEqualTo(team);
        assertThat(PrimaryUnitResolver.pick(List.of(delegated), null).getOrgUnit()).isEqualTo(otherDept);
    }

    @Test
    void deletedUnit_isIgnored_andEmptyGivesNull() {
        OrgUnit gone = unit("/r/x/y/");
        gone.setDeletedAt(Instant.now());
        assertThat(PrimaryUnitResolver.pick(List.of(row(gone, head), row(dept, staff)), gone.getId()).getOrgUnit())
                .isEqualTo(dept);
        assertThat(PrimaryUnitResolver.pick(List.of(), null)).isNull();
    }

    @Test
    void pickAll_readsPinnedFromEachRowsUser() {
        User other = User.builder().id(UUID.randomUUID()).primaryOrgUnitId(dept.getId()).build();
        UserRoleOrgUnit a = row(dept, staff); a.setUser(other);
        UserRoleOrgUnit b = row(team, staff); b.setUser(other);
        Map<UUID, UserRoleOrgUnit> picked = PrimaryUnitResolver.pickAll(List.of(a, b, row(team, staff)));
        assertThat(picked.get(other.getId()).getOrgUnit()).isEqualTo(dept);
        assertThat(picked.get(user.getId()).getOrgUnit()).isEqualTo(team);
    }

    private UserRoleOrgUnit row(OrgUnit unit, Role role) {
        return UserRoleOrgUnit.builder().user(user).orgUnit(unit).role(role).build();
    }

    private static OrgUnit unit(String path) {
        return OrgUnit.builder().id(UUID.randomUUID()).name(path).path(path).build();
    }

    private static Role role(int rank) {
        return Role.builder().id(UUID.randomUUID()).name("R" + rank).rank(rank).build();
    }
}
