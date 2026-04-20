package com.kpitracking.service;

import com.kpitracking.dto.request.auth.*;
import com.kpitracking.dto.response.auth.AuthResponse;
import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.dto.response.user.UserMembershipResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.OrganizationStatus;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.UserMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final RoleRepository roleRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;
    private final UserMapper userMapper;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final OrgHierarchyLevelRepository orgHierarchyLevelRepository;

    @Transactional
    public AuthResponse register(RegisterRequest request, String userAgent) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Người dùng", "email", request.getEmail());
        }
        if (request.getPhone() != null && !request.getPhone().trim().isEmpty() && userRepository.existsByPhone(request.getPhone())) {
            throw new DuplicateResourceException("Người dùng", "số điện thoại", request.getPhone());
        }
        if (organizationRepository.existsByCode(request.getOrganizationCode())) {
            throw new DuplicateResourceException("Tổ chức", "mã", request.getOrganizationCode());
        }

        // 1. Create Organization
        Organization organization = Organization.builder()
                .name(request.getOrganizationName())
                .code(request.getOrganizationCode())
                .status(OrganizationStatus.ACTIVE)
                .build();
        organization = organizationRepository.save(organization);

        // 2. Create Hierarchy Levels and root OrgUnit
        if (request.getHierarchyLevels() == null || request.getHierarchyLevels().size() < 3) {
            throw new BusinessException("Cơ cấu tổ chức phải có ít nhất 3 cấp.");
        }

        for (int i = 0; i < request.getHierarchyLevels().size(); i++) {
            HierarchyLevelDTO levelDto = request.getHierarchyLevels().get(i);
            OrgHierarchyLevel level = OrgHierarchyLevel.builder()
                    .organization(organization)
                    .levelOrder(i)
                    .unitTypeName(levelDto.getUnitTypeName())
                    .managerRoleLabel(levelDto.getManagerRoleLabel())
                    .build();
            orgHierarchyLevelRepository.save(level);
        }

        String rootType = request.getHierarchyLevels().get(0).getUnitTypeName();
        
        OrgHierarchyLevel rootLevel = orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(organization.getId()).get(0);

        OrgUnit rootUnit = OrgUnit.builder()
                .name(request.getOrganizationName())
                .orgHierarchyLevel(rootLevel)
                .path("/temp/")  // DB trigger will set the real path
                .build();
        rootUnit = orgUnitRepository.save(rootUnit);
        // Refresh to get trigger-computed path
        orgUnitRepository.flush();
        rootUnit = orgUnitRepository.findById(rootUnit.getId()).orElseThrow();

        // 3. Create User
        String verifyToken = UUID.randomUUID().toString();
        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .status(UserStatus.ACTIVE)
                .isEmailVerified(false)
                .verifyEmailToken(verifyToken)
                .verifyEmailTokenExpiry(Instant.now().plusSeconds(86400)) // 24 hours
                .build();
        user = userRepository.save(user);

        // 4. Find or create DIRECTOR role
        Role directorRole = roleRepository.findByName("DIRECTOR")
                .orElseGet(() -> {
                    Role newRole = Role.builder()
                            .name("DIRECTOR")
                            .isSystem(true)
                            .build();
                    return roleRepository.save(newRole);
                });

        // 5. Assign DIRECTOR role to user at root org unit
        UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                .user(user)
                .role(directorRole)
                .orgUnit(rootUnit)
                .assignedAt(Instant.now())
                .build();
        userRoleOrgUnitRepository.save(assignment);

        emailService.sendWelcomeEmail(user.getEmail(), user.getFullName());
        emailService.sendVerifyEmail(user.getEmail(), verifyToken);

        return AuthResponse.builder()
                .accessToken("")
                .refreshToken("")
                .tokenType("Bearer")
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String userAgent) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", request.getEmail()));

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException("Tài khoản chưa được kích hoạt. Trạng thái hiện tại: " + user.getStatus());
        }

        if (Boolean.FALSE.equals(user.getIsEmailVerified())) {
            throw new BusinessException("Vui lòng xác thực email của bạn trước khi đăng nhập.");
        }

        List<String> roleNames = getUserRoleNames(user.getId());
        String accessToken = jwtTokenProvider.generateAccessToken(user.getEmail(), roleNames);
        RefreshToken refreshToken = refreshTokenService.createOrUpdateRefreshToken(user.getId(), userAgent);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
                .build();
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenService.verifyRefreshToken(refreshTokenStr);
        User user = refreshToken.getUser();
        String currentDevice = refreshToken.getDeviceInfo();

        RefreshToken newRefreshToken = refreshTokenService.createOrUpdateRefreshToken(user.getId(), currentDevice);

        List<String> roleNames = getUserRoleNames(user.getId());
        String accessToken = jwtTokenProvider.generateAccessToken(user.getEmail(), roleNames);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(newRefreshToken.getToken())
                .tokenType("Bearer")
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
                .build();
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException("Mật khẩu hiện tại không chính xác.");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BusinessException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("New password and confirm password do not match");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        refreshTokenService.revokeAllUserTokens(user.getId());
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        String resetPasswordToken = UUID.randomUUID().toString();
        user.setResetPasswordToken(resetPasswordToken);
        user.setResetPasswordTokenExpiry(Instant.now().plusSeconds(3600)); // 1 hour
        userRepository.save(user);

        emailService.sendResetPasswordEmail(user.getEmail(), resetPasswordToken);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("New password and confirm password do not match");
        }

        User user = userRepository.findByResetPasswordToken(request.getToken())
                .orElseThrow(() -> new BusinessException("Mã đặt lại mật khẩu không hợp lệ"));

        if (user.getResetPasswordTokenExpiry() != null && user.getResetPasswordTokenExpiry().isBefore(Instant.now())) {
            throw new BusinessException("Mã đặt lại mật khẩu đã hết hạn");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetPasswordToken(null);
        user.setResetPasswordTokenExpiry(null);
        userRepository.save(user);

        refreshTokenService.revokeAllUserTokens(user.getId());
    }

    @Transactional
    public void verifyEmail(String token) {
        User user = userRepository.findByVerifyEmailToken(token)
                .orElseThrow(() -> new BusinessException("Mã xác thực không hợp lệ"));

        if (user.getVerifyEmailTokenExpiry() != null && user.getVerifyEmailTokenExpiry().isBefore(Instant.now())) {
            throw new BusinessException("Mã xác thực đã hết hạn");
        }

        user.setIsEmailVerified(true);
        user.setVerifyEmailToken(null);
        user.setVerifyEmailTokenExpiry(null);
        userRepository.save(user);
    }

    @Transactional
    public void resendVerificationToken(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        if (Boolean.TRUE.equals(user.getIsEmailVerified())) {
            throw new BusinessException("Email already verified");
        }

        String verifyToken = UUID.randomUUID().toString();
        user.setVerifyEmailToken(verifyToken);
        user.setVerifyEmailTokenExpiry(Instant.now().plusSeconds(86400)); // 24 hours
        userRepository.save(user);

        emailService.sendVerifyEmail(user.getEmail(), verifyToken);
    }

    @Transactional
    public void logout(String refreshTokenStr) {
        try {
            RefreshToken refreshToken = refreshTokenService.verifyRefreshToken(refreshTokenStr);
            refreshTokenService.revokeToken(refreshToken);
        } catch (Exception e) {
            log.warn("Logout called with invalid token: {}", e.getMessage());
        }
    }

    public UserInfoResponse getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return enrichUserInfo(userMapper.toUserInfoResponse(user));
    }

    private UserInfoResponse enrichUserInfo(UserInfoResponse response) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(response.getId());
        
        List<UserMembershipResponse> memberships = assignments.stream()
                .map(uro -> {
                    OrgUnit unit = uro.getOrgUnit();
                    String roleName = uro.getRole().getName();
                    
                    // Lookup custom labels from hierarchy
                    List<OrgHierarchyLevel> levels = orgHierarchyLevelRepository
                            .findByOrganizationIdOrderByLevelOrderAsc(unit.getOrgHierarchyLevel().getOrganization().getId());

                    String unitTypeLabel = unit.getOrgHierarchyLevel().getUnitTypeName();
                            
                    String roleLabel = levels.stream()
                            .filter(l -> l.getLevelOrder().equals(unit.getOrgHierarchyLevel().getLevelOrder()))
                            .map(OrgHierarchyLevel::getManagerRoleLabel)
                            .findFirst()
                            .orElse(roleName);
                    
                    // Fallback for STAFF if no manager role label
                    if (roleName.equals("STAFF")) {
                        roleLabel = "Nhân viên";
                    }

                    return UserMembershipResponse.builder()
                        .orgUnitId(unit.getId())
                        .organizationId(unit.getOrgHierarchyLevel().getOrganization().getId())
                        .orgUnitName(unit.getName())
                        .organizationName(unit.getOrgHierarchyLevel().getOrganization().getName())
                        .roleName(roleName)
                        .roleLabel(roleLabel)
                        .unitTypeLabel(unitTypeLabel)
                        .build();
                })
                .collect(Collectors.toList());
        
        response.setMemberships(memberships);
        response.setRoles(assignments.stream()
                .map(uro -> uro.getRole().getName())
                .distinct()
                .collect(Collectors.toList()));
        
        return response;
    }

    @Transactional
    public UserInfoResponse uploadAvatar(org.springframework.web.multipart.MultipartFile file) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        try {
            String avatarUrl = cloudinaryStorageService.uploadFile(file, "avatars");
            user.setAvatarUrl(avatarUrl);
            user = userRepository.save(user);
            return enrichUserInfo(userMapper.toUserInfoResponse(user));
        } catch (java.io.IOException e) {
            throw new BusinessException("Failed to upload avatar: " + e.getMessage());
        }
    }

    private List<String> getUserRoleNames(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(uro -> uro.getRole().getName())
                .distinct()
                .toList();
    }
}
