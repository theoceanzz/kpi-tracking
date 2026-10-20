package com.kpitracking.service;

import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.dto.response.user.UserMembershipResponse;
import com.kpitracking.dto.response.user.UserResponse;
import com.kpitracking.dto.response.userrole.UserRoleOrgUnitResponse;
import com.kpitracking.entity.User;
import com.kpitracking.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đơn vị chính (V46) + hai trường hợp: một người nhiều vai trò trong một đơn vị, một người thuộc
 * nhiều đơn vị. Luật chọn thuần có ở {@link PrimaryUnitResolverTest}; ở đây là đường ghi thật
 * (gán vai trò, form Sửa người dùng) trên dữ liệu demo.
 *
 * <p>Cần DB local (org demo DEMO1). Mỗi test rollback. Chạy tay: {@code ./mvnw test -Dtest=PrimaryUnitIT}.
 */
@SpringBootTest
@Transactional
class PrimaryUnitIT {

    private static final UUID PHONG_IT = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID TEAM_BACKEND = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID TEAM_CONTENT = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private static final UUID TEAM_DESIGN = UUID.fromString("abcdefab-cdef-cdef-cdef-abcdefabcdef");
    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired UserService userService;
    @Autowired UserRoleService userRoleService;
    @Autowired PrimaryUnitResolver primaryUnits;
    @Autowired UserRepository userRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager em;

    private UUID staff, teamLead, staffRole;

    @BeforeEach
    void loginAsDirector() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("director@demo.com", null, List.of()));
        staff = userId("staff@demo.com");
        teamLead = userId("teamlead@demo.com");
        staffRole = jdbc.queryForObject(
                "SELECT id FROM roles WHERE organization_id = ? AND rank = 2 AND deleted_at IS NULL LIMIT 1",
                UUID.class, DEMO1);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void migration_pinsCurrentHome() {
        assertThat(user(staff).getPrimaryOrgUnitId()).isEqualTo(TEAM_BACKEND);
        assertThat(user(teamLead).getPrimaryOrgUnitId()).isEqualTo(TEAM_BACKEND);
    }

    @Test
    void secondUnit_isSecondary_andDoesNotMoveHome() {
        assign(staff, staffRole, TEAM_CONTENT);

        assertThat(primaryUnits.unitOf(staff).getId()).isEqualTo(TEAM_BACKEND);
        UserResponse r = userService.getUserById(staff);
        assertThat(r.getMemberships()).extracting(UserMembershipResponse::getOrgUnitId).contains(TEAM_BACKEND, TEAM_CONTENT);
        assertThat(r.getMemberships().get(0).getOrgUnitId()).isEqualTo(TEAM_BACKEND);
        assertThat(r.getMemberships().get(0).isPrimary()).isTrue();
        assertThat(r.getMemberships()).filteredOn(UserMembershipResponse::isPrimary).hasSize(1);

        // Chấm / xếp loại: chỉ đơn vị chính. Thống kê đếm nhân sự: cả nơi kiêm nhiệm.
        assertThat(primaryUnits.primaryWithin(List.of(TEAM_CONTENT))).doesNotContainKey(staff);
        assertThat(primaryUnits.primaryWithin(List.of(TEAM_BACKEND))).containsKey(staff);
        assertThat(primaryUnits.membersWithin(List.of(TEAM_CONTENT))).containsKey(staff);

        // Màn thành viên của nơi kiêm nhiệm biết đơn vị chính ở đâu.
        UserRoleOrgUnitResponse row = userRoleService.getUsersByOrgUnit(TEAM_CONTENT).stream()
                .filter(x -> x.getUserId().equals(staff)).findFirst().orElseThrow();
        assertThat(row.getPrimaryOrgUnitId()).isEqualTo(TEAM_BACKEND);
    }

    @Test
    void savingEditForm_keepsOtherUnits() {
        assign(staff, staffRole, TEAM_CONTENT);

        // Form cũ luôn gửi kèm đơn vị + vai trò hiện tại dù chỉ sửa số điện thoại.
        userService.updateUser(staff, UpdateUserRequest.builder()
                .phone("0900000001").orgUnitId(TEAM_BACKEND).role(roleNameAt(staff, TEAM_BACKEND)).build());

        assertThat(units(staff)).contains(TEAM_BACKEND, TEAM_CONTENT);
        assertThat(primaryUnits.unitOf(staff).getId()).isEqualTo(TEAM_BACKEND);
    }

    @Test
    void choosingAnExistingUnit_onlySwitchesHome() {
        assign(staff, staffRole, TEAM_CONTENT);

        userService.updateUser(staff, UpdateUserRequest.builder().orgUnitId(TEAM_CONTENT).build());

        assertThat(units(staff)).contains(TEAM_BACKEND, TEAM_CONTENT);
        assertThat(primaryUnits.unitOf(staff).getId()).isEqualTo(TEAM_CONTENT);
        assertThat(userService.getUserById(staff).getMemberships().get(0).getOrgUnitId()).isEqualTo(TEAM_CONTENT);
    }

    @Test
    void choosingANewUnit_movesHome_keepsSecondaryUnit() {
        assign(staff, staffRole, TEAM_CONTENT);

        userService.updateUser(staff, UpdateUserRequest.builder().orgUnitId(TEAM_DESIGN).build());

        List<UUID> units = units(staff);
        assertThat(units).contains(TEAM_DESIGN, TEAM_CONTENT).doesNotContain(TEAM_BACKEND);
        // Dòng nhân viên tự sinh ở Phòng IT (cha của đơn vị cũ) không còn lý do giữ.
        assertThat(units).doesNotContain(PHONG_IT);
        assertThat(primaryUnits.unitOf(staff).getId()).isEqualTo(TEAM_DESIGN);
    }

    @Test
    void severalRolesInOneUnit_survivesEditForm_andHighestRoleRepresents() {
        assign(teamLead, staffRole, TEAM_BACKEND);
        String head = roleNameAt(teamLead, TEAM_BACKEND);

        userService.updateUser(teamLead, UpdateUserRequest.builder()
                .phone("0900000002").orgUnitId(TEAM_BACKEND).role(head).build());

        List<Integer> ranks = jdbc.queryForList("""
                SELECT r.rank FROM user_role_org_units x JOIN roles r ON r.id = x.role_id
                 WHERE x.user_id = ? AND x.org_unit_id = ? ORDER BY r.rank""", Integer.class, teamLead, TEAM_BACKEND);
        assertThat(ranks).containsExactly(0, 2);
        assertThat(primaryUnits.assignmentOf(teamLead).getRole().getRank()).isZero();
        assertThat(primaryUnits.membersWithin(List.of(TEAM_BACKEND)).get(teamLead).getRole().getRank()).isZero();
    }

    @Test
    void revokingHomeUnit_repinsToRemainingUnit() {
        assign(staff, staffRole, TEAM_CONTENT);

        userRoleService.revokeRole(staff, staffRole, TEAM_BACKEND);

        em.flush();
        assertThat(user(staff).getPrimaryOrgUnitId()).isNotEqualTo(TEAM_BACKEND);
        assertThat(primaryUnits.unitOf(staff).getId()).isNotEqualTo(TEAM_BACKEND);
    }

    private void assign(UUID userId, UUID roleId, UUID unitId) {
        userRoleService.assignRole(AssignRoleRequest.builder().userId(userId).roleId(roleId).orgUnitId(unitId).build());
        em.flush();
    }

    private List<UUID> units(UUID userId) {
        em.flush();
        return jdbc.queryForList("SELECT org_unit_id FROM user_role_org_units WHERE user_id = ?", UUID.class, userId);
    }

    private String roleNameAt(UUID userId, UUID unitId) {
        return jdbc.queryForObject("""
                SELECT r.name FROM user_role_org_units x JOIN roles r ON r.id = x.role_id
                 WHERE x.user_id = ? AND x.org_unit_id = ? ORDER BY r.rank LIMIT 1""", String.class, userId, unitId);
    }

    private User user(UUID id) {
        return userRepository.findById(id).orElseThrow();
    }

    private UUID userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, email);
    }
}
