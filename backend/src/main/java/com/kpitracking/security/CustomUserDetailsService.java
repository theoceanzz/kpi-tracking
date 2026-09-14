package com.kpitracking.security;

import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;

    public CustomUserDetailsService(
            UserRepository userRepository,
            UserRoleOrgUnitRepository userRoleOrgUnitRepository,
            RolePermissionRepository rolePermissionRepository) {
        this.userRepository = userRepository;
        this.userRoleOrgUnitRepository = userRoleOrgUnitRepository;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        // Get all roles from user_role_org_units
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(user.getId());

        List<GrantedAuthority> authorities = new java.util.ArrayList<>(userRoles.stream()
                .map(UserRoleOrgUnit::getRole)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
                .distinct()
                .toList());

        // Get all permissions for these roles
        List<SimpleGrantedAuthority> permissionAuthorities = userRoles.stream()
                .map(UserRoleOrgUnit::getRole)
                .distinct()
                .flatMap(role -> rolePermissionRepository.findByRoleId(role.getId()).stream())
                .map(rp -> new SimpleGrantedAuthority(rp.getPermission().getCode()))
                .distinct()
                .toList();

        authorities.addAll(permissionAuthorities);

        // If no authorities assigned, give a default role
        if (authorities.isEmpty()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        }

        // Tổ chức của vai trò đầu tiên — chỉ để ghi MDC/log, không dùng cho phân quyền.
        java.util.UUID organizationId = userRoles.stream()
                .map(uro -> com.kpitracking.security.PermissionChecker.organizationIdOf(uro.getOrgUnit()))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);

        return new AppUserPrincipal(
                user.getEmail(),
                user.getPassword(),
                user.getStatus() == com.kpitracking.enums.UserStatus.ACTIVE,
                authorities,
                user.getId(),
                organizationId
        );
    }
}
