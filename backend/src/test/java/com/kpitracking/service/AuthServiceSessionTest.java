package com.kpitracking.service;

import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.mapper.UserMapper;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đăng xuất không được ném lỗi với token hỏng, và hồ sơ đăng nhập phải báo rõ khi người dùng chưa
 * thuộc tổ chức nào ({@code needsOrganization}) — frontend dựa vào cờ đó để không gọi API theo tổ chức.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceSessionTest {

    @Mock UserRepository userRepository;
    @Mock UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    @Mock RolePermissionRepository rolePermissionRepository;
    @Mock RefreshTokenService refreshTokenService;
    @Mock UserMapper userMapper;
    @Mock SecurityAuditService securityAudit;
    @Mock com.kpitracking.i18n.UserLanguageResolver userLanguageResolver;

    @InjectMocks AuthService authService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ── Đăng xuất ──────────────────────────────────────────────────────────

    @Test
    void logout_withRevokedOrUnknownToken_doesNotThrowAndDoesNotAudit() {
        when(refreshTokenService.revokeIfActive("dead-token")).thenReturn(Optional.empty());

        assertThatCode(() -> authService.logout("dead-token")).doesNotThrowAnyException();

        verify(securityAudit, never()).recordForEmail(any(), any(), any(), any());
    }

    @Test
    void logout_withActiveToken_recordsLogoutAudit() {
        when(refreshTokenService.revokeIfActive("live-token")).thenReturn(Optional.of("a@zam.vn"));

        authService.logout("live-token");

        verify(securityAudit).recordForEmail(eq(SecurityAuditEvent.LOGOUT),
                eq(SecurityAuditService.OK), eq("a@zam.vn"), isNull());
    }

    @Test
    void logout_doesNotGoThroughThrowingVerifyRefreshToken() {
        when(refreshTokenService.revokeIfActive(any())).thenReturn(Optional.empty());

        authService.logout("whatever");

        // verifyRefreshToken ném lỗi qua proxy → transaction rollback-only; đăng xuất không được gọi nó.
        verify(refreshTokenService, never()).verifyRefreshToken(any(String.class));
    }

    // ── Cờ needsOrganization ─────────────────────────────────────────────

    @Test
    void me_userWithoutMembership_needsOrganization() {
        User user = loggedIn(false);
        when(userRoleOrgUnitRepository.findByUserId(user.getId())).thenReturn(List.of());

        UserInfoResponse me = authService.getCurrentUser();

        assertThat(me.getMemberships()).isEmpty();
        assertThat(me.getNeedsOrganization()).isTrue();
    }

    @Test
    void me_platformAdminWithoutMembership_doesNotNeedOrganization() {
        User user = loggedIn(true);
        when(userRoleOrgUnitRepository.findByUserId(user.getId())).thenReturn(List.of());

        assertThat(authService.getCurrentUser().getNeedsOrganization()).isFalse();
    }

    @Test
    void me_userWithMembership_doesNotNeedOrganization() {
        User user = loggedIn(false);
        Organization org = Organization.builder().id(UUID.randomUUID()).name("CTCP GEMS").build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().organization(org).levelOrder(1).unitTypeName("Công ty").build();
        OrgUnit unit = OrgUnit.builder().id(UUID.randomUUID()).name("GEMS").code("GEM").orgHierarchyLevel(level).build();
        Role role = Role.builder().id(UUID.randomUUID()).name("Giám đốc").rank(0).level(1).build();
        UserRoleOrgUnit uro = UserRoleOrgUnit.builder().user(user).role(role).orgUnit(unit).build();
        when(userRoleOrgUnitRepository.findByUserId(user.getId())).thenReturn(List.of(uro));

        UserInfoResponse me = authService.getCurrentUser();

        assertThat(me.getMemberships()).hasSize(1);
        assertThat(me.getMemberships().get(0).getOrganizationId()).isEqualTo(org.getId());
        assertThat(me.getNeedsOrganization()).isFalse();
    }

    private User loggedIn(boolean platformAdmin) {
        User user = User.builder().id(UUID.randomUUID()).email("b@gems.vn").isPlatformAdmin(platformAdmin).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of()));
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(userMapper.toUserInfoResponse(user)).thenReturn(UserInfoResponse.builder()
                .id(user.getId()).email(user.getEmail()).isPlatformAdmin(platformAdmin).build());
        return user;
    }
}
