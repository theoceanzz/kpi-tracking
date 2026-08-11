package com.kpitracking.service;

import com.kpitracking.dto.response.auth.AuthResponse;
import com.kpitracking.dto.response.auth.LarkApiResponses.TokenResponse;
import com.kpitracking.dto.response.auth.LarkApiResponses.UserInfoData;
import com.kpitracking.dto.response.auth.LarkAuthorizeUrlResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.DataProtection;
import com.kpitracking.security.OAuthStateService;
import com.kpitracking.service.LarkCredentialResolver.LarkCredentials;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Đăng nhập bằng Lark theo từng tổ chức.
 *
 * <p>Người dùng chọn công ty trước, KeyGo dùng ứng dụng Lark của chính công ty đó để xác thực,
 * rồi đối chiếu {@code tenant_key} nhận về với giá trị đã lưu. Người của công ty khác không vào
 * được: Lark chặn ngay từ màn hình đồng ý, và nếu lọt qua thì bước đối chiếu tenant sẽ chặn.
 *
 * <p>Tài khoản chưa tồn tại sẽ được tạo tự động và gán vào đơn vị/vai trò mặc định do quản trị
 * viên tổ chức cấu hình sẵn.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LarkAuthService {

    private final LarkOAuthClient larkOAuthClient;
    private final LarkCredentialResolver credentialResolver;
    private final OAuthStateService oAuthStateService;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PasswordEncoder passwordEncoder;
    private final DataProtection dataProtection;
    private final AuthService authService;

    public LarkAuthorizeUrlResponse getAuthorizeUrl(UUID organizationId) {
        Organization org = loadOrganization(organizationId);

        if (!Boolean.TRUE.equals(org.getLarkEnabled())) {
            throw new BusinessException(
                    "Tổ chức " + org.getName() + " chưa bật đăng nhập bằng Lark.");
        }

        LarkCredentials credentials = credentialResolver.resolve(org);
        String state = oAuthStateService.generateLarkState(organizationId, OAuthStateService.Purpose.LOGIN);

        return LarkAuthorizeUrlResponse.builder()
                .authorizeUrl(larkOAuthClient.buildAuthorizeUrl(credentials.appId(), state))
                .state(state)
                .build();
    }

    @Transactional
    public AuthResponse loginWithLark(String code, String state, String deviceInfo) {
        OAuthStateService.StateData stateData = oAuthStateService.validateLarkState(state);
        if (stateData.purpose() != OAuthStateService.Purpose.LOGIN) {
            throw new BusinessException("Phiên đăng nhập Lark không hợp lệ. Vui lòng thử lại.");
        }

        Organization org = loadOrganization(stateData.organizationId());
        UserInfoData larkUser = fetchLarkUser(org, code);

        verifyTenant(org, larkUser);

        String email = larkUser.resolveEmail();
        if (email == null) {
            throw new BusinessException("Không lấy được email từ Lark. Vui lòng kiểm tra quyền "
                    + "contact:user.email:readonly của ứng dụng Lark.");
        }

        String openIdHash = dataProtection.blindIndex(larkUser.openId());
        User user = userRepository.findByLarkOpenIdHash(openIdHash)
                .or(() -> userRepository.findByEmail(email))
                .orElse(null);

        if (user == null) {
            user = provisionUser(org, larkUser, email);
        } else {
            ensureBelongsToOrganization(user, org);
            if (user.getStatus() != UserStatus.ACTIVE) {
                throw new BusinessException(
                        "Tài khoản chưa được kích hoạt. Trạng thái hiện tại: " + user.getStatus());
            }
        }

        linkLarkIdentity(user, larkUser, openIdHash);

        log.info("Đăng nhập Lark thành công: {} vào tổ chức {}", user.getEmail(), org.getName());
        return authService.issueAuthResponse(user, deviceInfo);
    }

    /**
     * Đổi code lấy thông tin người dùng Lark bằng credential của tổ chức.
     * Dùng chung cho cả đăng nhập và luồng quản trị viên kết nối tổ chức.
     */
    UserInfoData fetchLarkUser(Organization org, String code) {
        LarkCredentials credentials = credentialResolver.resolve(org);
        TokenResponse token = larkOAuthClient.exchangeCodeForToken(
                credentials.appId(), credentials.appSecret(), code);
        return larkOAuthClient.fetchUserInfo(token.accessToken());
    }

    /** Chốt xác thực công ty: so trên HMAC, không giải mã gì trên đường nóng. */
    private void verifyTenant(Organization org, UserInfoData larkUser) {
        if (org.getLarkTenantKeyHash() == null) {
            throw new BusinessException(
                    "Tổ chức " + org.getName() + " chưa xác minh liên kết với Lark.");
        }
        if (larkUser.tenantKey() == null
                || !dataProtection.matchesBlindIndex(larkUser.tenantKey(), org.getLarkTenantKeyHash())) {
            log.warn("Chặn đăng nhập Lark: tenant không khớp với tổ chức {}", org.getName());
            throw new BusinessException(
                    "Tài khoản Lark của bạn không thuộc " + org.getName() + ".");
        }
    }

    /**
     * Email là duy nhất toàn hệ thống nên một người chỉ có một tài khoản KeyGo.
     * Nếu tài khoản đó đã thuộc tổ chức khác thì từ chối thay vì âm thầm chuyển tổ chức.
     */
    private void ensureBelongsToOrganization(User user, Organization org) {
        List<UserRoleOrgUnit> memberships = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (memberships.isEmpty()) {
            // Tài khoản chưa được gán đơn vị nào — gán vào đơn vị mặc định của tổ chức này
            assignDefaultMembership(user, org);
            return;
        }
        boolean inThisOrg = memberships.stream().anyMatch(m -> org.getId().equals(
                m.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId()));
        if (!inThisOrg) {
            throw new BusinessException("Email " + user.getEmail()
                    + " đã thuộc một tổ chức khác trong hệ thống. Vui lòng liên hệ quản trị viên.");
        }
    }

    private User provisionUser(Organization org, UserInfoData larkUser, String email) {
        requireDefaults(org);

        String fullName = larkUser.name() != null && !larkUser.name().isBlank()
                ? larkUser.name()
                : email;

        User user = User.builder()
                .email(email)
                .fullName(fullName)
                .avatarUrl(larkUser.avatarUrl())
                // Cột password NOT NULL nhưng người dùng SSO không bao giờ dùng tới
                .password(passwordEncoder.encode(generateRandomPassword()))
                .status(UserStatus.ACTIVE)
                .isEmailVerified(true)
                .requirePasswordChange(false)
                .build();
        user = userRepository.save(user);

        assignDefaultMembership(user, org);
        log.info("Tạo tài khoản tự động từ Lark: {} vào tổ chức {}", email, org.getName());
        return user;
    }

    private void assignDefaultMembership(User user, Organization org) {
        requireDefaults(org);
        userRoleOrgUnitRepository.save(UserRoleOrgUnit.builder()
                .user(user)
                .role(org.getLarkDefaultRole())
                .orgUnit(org.getLarkDefaultOrgUnit())
                .build());
    }

    /**
     * Lưới an toàn: đã chặn từ lúc bật cờ, nhưng nếu cấu hình bị xoá sau đó thì phải báo rõ
     * thay vì tạo ra tài khoản không thuộc đơn vị nào — loại tài khoản đó sẽ làm mọi API
     * cần tổ chức hiện tại ném lỗi.
     */
    private void requireDefaults(Organization org) {
        if (org.getLarkDefaultOrgUnit() == null || org.getLarkDefaultRole() == null) {
            throw new BusinessException("Tổ chức " + org.getName()
                    + " chưa cấu hình đơn vị và vai trò mặc định cho người dùng đăng nhập bằng Lark. "
                    + "Vui lòng liên hệ quản trị viên.");
        }
    }

    private void linkLarkIdentity(User user, UserInfoData larkUser, String openIdHash) {
        user.setLarkOpenIdHash(openIdHash);
        user.setLarkUnionId(larkUser.unionId());

        // Lark đã xác thực chính email này nên không cần bắt nhập OTP nữa
        user.setIsEmailVerified(true);
        // Người dùng SSO không dùng tới mật khẩu nội bộ
        user.setRequirePasswordChange(false);

        if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank())
                && larkUser.avatarUrl() != null && !larkUser.avatarUrl().isBlank()) {
            user.setAvatarUrl(larkUser.avatarUrl());
        }
        userRepository.save(user);
    }

    private Organization loadOrganization(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", organizationId));
    }

    private String generateRandomPassword() {
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) + "A1@";
    }
}
