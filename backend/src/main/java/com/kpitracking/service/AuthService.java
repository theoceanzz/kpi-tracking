package com.kpitracking.service;

import com.kpitracking.dto.request.auth.*;
import com.kpitracking.dto.response.auth.AuthResponse;
import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.OrganizationStatus;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
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
<<<<<<< HEAD
    private final UserMapper userMapper;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final com.kpitracking.repository.DepartmentMemberRepository departmentMemberRepository;
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b

    @Transactional
    public AuthResponse register(RegisterRequest request, String userAgent) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User", "email", request.getEmail());
        }
        if (request.getPhone() != null && !request.getPhone().trim().isEmpty() && userRepository.existsByPhone(request.getPhone())) {
            throw new DuplicateResourceException("User", "phone", request.getPhone());
        }
        if (organizationRepository.existsByCode(request.getOrganizationCode())) {
            throw new DuplicateResourceException("Organization", "code", request.getOrganizationCode());
        }

<<<<<<< HEAD
        Company company = Company.builder()
                .name(request.getCompanyName())
                .taxCode(request.getTaxCode())
                .email(request.getEmail())
                .phone(request.getPhone())
                .status(CompanyStatus.TRIAL)
=======
        // 1. Create Organization
        Organization organization = Organization.builder()
                .name(request.getOrganizationName())
                .code(request.getOrganizationCode())
                .status(OrganizationStatus.ACTIVE)
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .build();
        organization = organizationRepository.save(organization);

        // 2. Create root OrgUnit (type = "company")
        OrgUnit rootUnit = OrgUnit.builder()
                .name(request.getOrganizationName())
                .organization(organization)
                .type("company")
                .path("/temp/")  // DB trigger will set the real path
                .level(0)
                .build();
        rootUnit = orgUnitRepository.save(rootUnit);
        // Refresh to get trigger-computed path
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
                .build();
        userRoleOrgUnitRepository.save(assignment);

        emailService.sendWelcomeEmail(user.getEmail(), user.getFullName());
        emailService.sendVerifyEmail(user.getEmail(), verifyToken);

        return AuthResponse.builder()
                .accessToken("")
                .refreshToken("")
                .tokenType("Bearer")
<<<<<<< HEAD
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
=======
                .user(buildUserInfoResponse(user))
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String userAgent) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException("Account is not active. Current status: " + user.getStatus());
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
<<<<<<< HEAD
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
=======
                .user(buildUserInfoResponse(user))
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
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
<<<<<<< HEAD
                .user(enrichUserInfo(userMapper.toUserInfoResponse(user)))
=======
                .user(buildUserInfoResponse(user))
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .build();
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException("Current password is incorrect");
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
                .orElseThrow(() -> new BusinessException("Invalid reset token"));

        if (user.getResetPasswordTokenExpiry() != null && user.getResetPasswordTokenExpiry().isBefore(Instant.now())) {
            throw new BusinessException("Reset token has expired");
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
                .orElseThrow(() -> new BusinessException("Invalid verification token"));

        if (user.getVerifyEmailTokenExpiry() != null && user.getVerifyEmailTokenExpiry().isBefore(Instant.now())) {
            throw new BusinessException("Verification token has expired");
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
<<<<<<< HEAD
        return enrichUserInfo(userMapper.toUserInfoResponse(user));
    }

    private UserInfoResponse enrichUserInfo(UserInfoResponse response) {
        java.util.List<com.kpitracking.dto.response.user.UserMembershipResponse> memberships = departmentMemberRepository.findByUserId(response.getId()).stream()
                .map(dm -> com.kpitracking.dto.response.user.UserMembershipResponse.builder()
                        .departmentId(dm.getDepartment().getId())
                        .departmentName(dm.getDepartment().getName())
                        .position(dm.getPosition())
                        .build())
                .toList();
        response.setMemberships(memberships);
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
=======
        return buildUserInfoResponse(user);
    }

    private List<String> getUserRoleNames(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(uro -> uro.getRole().getName())
                .distinct()
                .toList();
    }

    private UserInfoResponse buildUserInfoResponse(User user) {
        List<String> roleNames = getUserRoleNames(user.getId());
        return UserInfoResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleNames)
                .build();
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
    }
}
