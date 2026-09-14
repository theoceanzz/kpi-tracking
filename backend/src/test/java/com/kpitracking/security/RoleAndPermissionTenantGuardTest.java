package com.kpitracking.security;

import com.kpitracking.dto.request.permission.AssignPermissionRequest;
import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.PermissionMapper;
import com.kpitracking.mapper.UserRoleOrgUnitMapper;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.PermissionRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.PermissionService;
import com.kpitracking.service.UserRoleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hồi quy: {@code @PreAuthorize("hasAuthority('ROLE:ASSIGN')")} / {@code 'PERMISSION:EDIT'} ở
 * controller chỉ là quyền "ở đâu đó"; service phải kiểm lại quyền ấy có hiệu lực ở đúng đơn vị /
 * tổ chức đích do client gửi lên.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RoleAndPermissionTenantGuardTest {

    @Mock UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock OrgUnitRepository orgUnitRepository;
    @Mock UserRoleOrgUnitMapper userRoleMapper;
    @Mock PermissionRepository permissionRepository;
    @Mock RolePermissionRepository rolePermissionRepository;
    @Mock PermissionMapper permissionMapper;
    @Mock PermissionChecker permissionChecker;
    @Mock SecurityAuditService securityAudit;

    UserRoleService userRoleService;
    PermissionService permissionService;

    User me;
    UUID unitOfOrgB;
    Role roleOfOrgB;

    @BeforeEach
    void setUp() {
        userRoleService = new UserRoleService(userRoleOrgUnitRepository, userRepository, roleRepository,
                orgUnitRepository, userRoleMapper, permissionChecker, securityAudit);
        permissionService = new PermissionService(permissionRepository, rolePermissionRepository,
                roleRepository, permissionMapper, userRepository, permissionChecker, securityAudit);

        me = User.builder().id(UUID.randomUUID()).email("manager@a.vn").build();
        when(userRepository.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(me.getEmail(), null, List.of()));

        unitOfOrgB = UUID.randomUUID();
        Organization orgB = Organization.builder().id(UUID.randomUUID()).name("B").code("B").build();
        roleOfOrgB = Role.builder().id(UUID.randomUUID()).organization(orgB).name("TRƯỞNG PHÒNG").build();
        when(roleRepository.findById(roleOfOrgB.getId())).thenReturn(Optional.of(roleOfOrgB));

        // Người này KHÔNG có quyền nào ở org B, dù ở org A có ROLE:ASSIGN / PERMISSION:EDIT.
        when(permissionChecker.hasPermissionInOrgUnit(eq(me.getId()), any(), eq(unitOfOrgB))).thenReturn(false);
        when(permissionChecker.isGlobalAdminIn(eq(me.getId()), eq(unitOfOrgB))).thenReturn(false);
        when(permissionChecker.hasPermissionInOrganization(eq(me.getId()), any(), eq(orgB.getId()))).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Gán vai trò vào đơn vị của tổ chức khác → 403, không ghi DB, có audit ACCESS_DENIED")
    void assignRole_outsideScope_isForbidden() {
        AssignRoleRequest req = AssignRoleRequest.builder()
                .userId(UUID.randomUUID()).roleId(roleOfOrgB.getId()).orgUnitId(unitOfOrgB).build();

        assertThatThrownBy(() -> userRoleService.assignRole(req)).isInstanceOf(ForbiddenException.class);

        verify(userRoleOrgUnitRepository, never()).save(any());
        verify(securityAudit).record(eq(SecurityAuditEvent.ACCESS_DENIED), eq(SecurityAuditService.BLOCKED),
                eq("ORG_UNIT"), eq(unitOfOrgB.toString()), any());
    }

    @Test
    @DisplayName("Thu hồi / gỡ hàng loạt ngoài phạm vi cũng bị chặn")
    void revokeAndRemove_outsideScope_areForbidden() {
        assertThatThrownBy(() -> userRoleService.revokeRole(UUID.randomUUID(), roleOfOrgB.getId(), unitOfOrgB))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> userRoleService.removeAllUsersFromOrgUnit(unitOfOrgB))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> userRoleService.removeBulkUsersFromOrgUnit(List.of(UUID.randomUUID()), unitOfOrgB))
                .isInstanceOf(ForbiddenException.class);

        verify(userRoleOrgUnitRepository, never()).deleteByUserIdAndRoleIdAndOrgUnitId(any(), any(), any());
        verify(userRoleOrgUnitRepository, never()).deleteByOrgUnitId(any());
        verify(userRoleOrgUnitRepository, never()).deleteByUserIdInAndOrgUnitId(any(), any());
    }

    @Test
    @DisplayName("Sửa bộ quyền của vai trò thuộc tổ chức khác → 403, không đụng role_permissions")
    void assignPermissions_toRoleOfAnotherOrg_isForbidden() {
        AssignPermissionRequest req = AssignPermissionRequest.builder()
                .permissionIds(List.of(UUID.randomUUID())).build();

        assertThatThrownBy(() -> permissionService.assignPermissionsToRole(roleOfOrgB.getId(), req))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> permissionService.removePermissionFromRole(roleOfOrgB.getId(), UUID.randomUUID()))
                .isInstanceOf(ForbiddenException.class);

        verify(rolePermissionRepository, never()).save(any());
        verify(rolePermissionRepository, never()).deleteByRoleIdAndPermissionId(any(), any());
    }
}
