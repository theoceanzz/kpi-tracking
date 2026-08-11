package com.kpitracking.service;

import com.kpitracking.config.LarkProperties;
import com.kpitracking.dto.request.organization.UpdateLarkSettingsRequest;
import com.kpitracking.dto.response.auth.LarkApiResponses.UserInfoData;
import com.kpitracking.dto.response.auth.LarkAuthorizeUrlResponse;
import com.kpitracking.dto.response.organization.LarkConnectResultResponse;
import com.kpitracking.dto.response.organization.LarkSettingsResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.LarkConnectionMode;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.DataProtection;
import com.kpitracking.security.OAuthStateService;
import com.kpitracking.service.LarkCredentialResolver.LarkCredentials;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Cấu hình kết nối Lark cho một tổ chức.
 *
 * <p>Mọi thao tác đều kiểm tra tổ chức đích trùng với tổ chức của người đang đăng nhập —
 * quyền {@code COMPANY:UPDATE} một mình chưa đủ, vì nó không ràng buộc theo tổ chức.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LarkSettingsService {

    private static final String[] REQUIRED_SCOPES = {
            "contact:user.base:readonly",
            "contact:user.email:readonly",
            // Tuỳ chọn: chỉ để hiện tên doanh nghiệp lúc xác nhận liên kết
            "tenant:tenant:readonly"
    };

    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final LarkOAuthClient larkOAuthClient;
    private final LarkCredentialResolver credentialResolver;
    private final LarkAuthService larkAuthService;
    private final OAuthStateService oAuthStateService;
    private final LarkProperties larkProperties;
    private final DataProtection dataProtection;

    @Transactional(readOnly = true)
    public LarkSettingsResponse getSettings(UUID orgId) {
        Organization org = loadAuthorized(orgId);
        return toResponse(org);
    }

    @Transactional
    public LarkSettingsResponse updateSettings(UUID orgId, UpdateLarkSettingsRequest request) {
        Organization org = loadAuthorized(orgId);

        if (request.getConnectionMode() != null) {
            if (request.getConnectionMode() == LarkConnectionMode.STORE) {
                throw new BusinessException("Chế độ ứng dụng Lark dùng chung chưa được hỗ trợ. "
                        + "Vui lòng dùng chế độ tự tạo ứng dụng.");
            }
            org.setLarkConnectionMode(request.getConnectionMode());
        }

        if (request.getAppId() != null) {
            String newAppId = request.getAppId().trim();
            // Đổi App ID nghĩa là trỏ sang ứng dụng Lark khác -> liên kết tenant cũ không còn giá trị
            if (!newAppId.equals(org.getLarkAppId())) {
                clearVerification(org);
            }
            org.setLarkAppId(newAppId.isEmpty() ? null : newAppId);
        }

        // Để trống nghĩa là giữ nguyên secret đang lưu, không phải xoá đi
        if (request.getAppSecret() != null && !request.getAppSecret().isBlank()) {
            org.setLarkAppSecret(request.getAppSecret().trim());
        }

        if (request.getDefaultOrgUnitId() != null) {
            org.setLarkDefaultOrgUnit(loadOrgUnitInOrganization(request.getDefaultOrgUnitId(), org));
        }
        if (request.getDefaultRoleId() != null) {
            org.setLarkDefaultRole(loadRoleInOrganization(request.getDefaultRoleId(), org));
        }

        if (request.getLarkEnabled() != null) {
            if (Boolean.TRUE.equals(request.getLarkEnabled())) {
                List<String> missing = findMissingRequirements(org);
                if (!missing.isEmpty()) {
                    throw new BusinessException("Chưa bật được đăng nhập Lark. Còn thiếu: "
                            + String.join("; ", missing));
                }
            }
            org.setLarkEnabled(request.getLarkEnabled());
        }

        return toResponse(organizationRepository.save(org));
    }

    @Transactional(readOnly = true)
    public LarkOAuthClient.TestResult testConnection(UUID orgId) {
        Organization org = loadAuthorized(orgId);
        LarkCredentials credentials = credentialResolver.resolve(org);
        return larkOAuthClient.testCredentials(credentials.appId(), credentials.appSecret());
    }

    @Transactional(readOnly = true)
    public LarkAuthorizeUrlResponse getConnectUrl(UUID orgId) {
        Organization org = loadAuthorized(orgId);
        LarkCredentials credentials = credentialResolver.resolve(org);
        String state = oAuthStateService.generateLarkState(orgId, OAuthStateService.Purpose.CONNECT);

        return LarkAuthorizeUrlResponse.builder()
                .authorizeUrl(larkOAuthClient.buildAuthorizeUrl(credentials.appId(), state))
                .state(state)
                .build();
    }

    /**
     * Quản trị viên vừa đăng nhập Lark xong. Đọc tenant_key về nhưng chưa lưu — trả tên tổ chức
     * để họ đối chiếu bằng mắt rồi mới xác nhận.
     */
    @Transactional(readOnly = true)
    public LarkConnectResultResponse connect(String code, String state) {
        OAuthStateService.StateData stateData = oAuthStateService.validateLarkState(state);
        if (stateData.purpose() != OAuthStateService.Purpose.CONNECT) {
            throw new BusinessException("Phiên kết nối Lark không hợp lệ. Vui lòng thử lại.");
        }

        Organization org = loadAuthorized(stateData.organizationId());
        UserInfoData larkUser = larkAuthService.fetchLarkUser(org, code);

        if (larkUser.tenantKey() == null || larkUser.tenantKey().isBlank()) {
            throw new BusinessException("Lark không trả về định danh tổ chức. Vui lòng thử lại.");
        }

        // Tên và logo doanh nghiệp là tuỳ chọn (cần quyền tenant:tenant:readonly).
        LarkCredentials credentials = credentialResolver.resolve(org);
        LarkOAuthClient.TenantProfile profile = larkOAuthClient
                .fetchTenantProfile(credentials.appId(), credentials.appSecret())
                .orElse(new LarkOAuthClient.TenantProfile(null, null));
        String tenantHash = dataProtection.blindIndex(larkUser.tenantKey());

        // Quyền đọc thông tin doanh nghiệp có thể mất hiệu lực bất cứ lúc nào (phải phát hành lại
        // phiên bản). Khi đó, nếu vẫn là cùng tổ chức Lark thì dùng lại tên/logo đang lưu thay vì
        // để trống — tránh việc liên kết lại làm mất dữ liệu đã có.
        boolean sameTenant = tenantHash.equals(org.getLarkTenantKeyHash());
        boolean usingSavedProfile = false;

        String tenantName = profile.name();
        String tenantAvatarUrl = profile.avatarUrl();
        if (sameTenant) {
            if (!StringUtils.hasText(tenantName) && StringUtils.hasText(org.getLarkTenantName())) {
                tenantName = org.getLarkTenantName();
                usingSavedProfile = true;
            }
            if (!StringUtils.hasText(tenantAvatarUrl)
                    && StringUtils.hasText(org.getLarkTenantAvatarUrl())) {
                tenantAvatarUrl = org.getLarkTenantAvatarUrl();
                usingSavedProfile = true;
            }
        }

        // Tổ chức Lark này đã có công ty khác liên kết chưa?
        Optional<Organization> existing = organizationRepository.findByLarkTenantKeyHash(tenantHash);
        boolean alreadyLinked = existing.isPresent() && !existing.get().getId().equals(org.getId());

        return LarkConnectResultResponse.builder()
                .tenantName(tenantName)
                .tenantAvatarUrl(tenantAvatarUrl)
                .usingSavedProfile(usingSavedProfile)
                .userName(larkUser.name())
                .userEmail(larkUser.resolveEmail())
                .userAvatarUrl(larkUser.avatarUrl())
                .pendingToken(oAuthStateService.generatePendingConnection(
                        org.getId(), larkUser.tenantKey(), tenantName, tenantAvatarUrl))
                .alreadyLinked(alreadyLinked)
                .alreadyLinkedOrganizationName(alreadyLinked ? existing.get().getName() : null)
                .build();
    }

    @Transactional
    public LarkSettingsResponse confirmConnection(String pendingToken) {
        OAuthStateService.PendingConnection pending =
                oAuthStateService.validatePendingConnection(pendingToken);

        Organization org = loadAuthorized(pending.organizationId());
        String tenantHash = dataProtection.blindIndex(pending.tenantKey());

        organizationRepository.findByLarkTenantKeyHash(tenantHash).ifPresent(other -> {
            if (!other.getId().equals(org.getId())) {
                throw new BusinessException("Tổ chức Lark này đã được liên kết với công ty "
                        + other.getName() + " trong hệ thống.");
            }
        });

        // Vẫn là cùng tổ chức Lark thì giá trị cũ còn dùng được; khác tổ chức thì phải xoá,
        // vì tên và logo cũ thuộc về tổ chức trước đó — hiển thị tiếp là sai danh tính.
        boolean sameTenant = tenantHash.equals(org.getLarkTenantKeyHash());

        org.setLarkTenantKeyHash(tenantHash);
        org.setLarkTenantKey(pending.tenantKey());

        if (StringUtils.hasText(pending.tenantName())) {
            org.setLarkTenantName(pending.tenantName());
        } else if (!sameTenant) {
            org.setLarkTenantName(null);
        }

        if (StringUtils.hasText(pending.tenantAvatarUrl())) {
            org.setLarkTenantAvatarUrl(pending.tenantAvatarUrl());
        } else if (!sameTenant) {
            org.setLarkTenantAvatarUrl(null);
        }

        org.setLarkVerifiedAt(Instant.now());

        log.info("Tổ chức {} đã liên kết với Lark", org.getName());
        return toResponse(organizationRepository.save(org));
    }

    @Transactional
    public LarkSettingsResponse disconnect(UUID orgId) {
        Organization org = loadAuthorized(orgId);
        clearVerification(org);
        org.setLarkEnabled(false);
        return toResponse(organizationRepository.save(org));
    }

    // ===== helpers =====

    private void clearVerification(Organization org) {
        org.setLarkTenantKeyHash(null);
        org.setLarkTenantKey(null);
        org.setLarkTenantName(null);
        // Phải xoá cả logo, nếu không huỷ liên kết xong vẫn còn logo công ty cũ
        org.setLarkTenantAvatarUrl(null);
        org.setLarkVerifiedAt(null);
        org.setLarkEnabled(false);
    }

    private List<String> findMissingRequirements(Organization org) {
        List<String> missing = new ArrayList<>();
        if (org.getLarkConnectionMode() == LarkConnectionMode.CUSTOM_APP) {
            if (org.getLarkAppId() == null || org.getLarkAppId().isBlank()) {
                missing.add("App ID");
            }
            if (org.getLarkAppSecret() == null || org.getLarkAppSecret().isBlank()) {
                missing.add("App Secret");
            }
        }
        if (org.getLarkTenantKeyHash() == null) {
            missing.add("xác minh tổ chức Lark");
        }
        if (org.getLarkDefaultOrgUnit() == null) {
            missing.add("đơn vị mặc định");
        }
        if (org.getLarkDefaultRole() == null) {
            missing.add("vai trò mặc định");
        }
        return missing;
    }

    private LarkSettingsResponse toResponse(Organization org) {
        return LarkSettingsResponse.builder()
                .connectionMode(org.getLarkConnectionMode())
                .larkEnabled(org.getLarkEnabled())
                .appId(org.getLarkAppId())
                .hasAppSecret(org.getLarkAppSecret() != null && !org.getLarkAppSecret().isBlank())
                .tenantName(org.getLarkTenantName())
                .tenantAvatarUrl(org.getLarkTenantAvatarUrl())
                .verifiedAt(org.getLarkVerifiedAt())
                .defaultOrgUnitId(org.getLarkDefaultOrgUnit() != null
                        ? org.getLarkDefaultOrgUnit().getId() : null)
                .defaultRoleId(org.getLarkDefaultRole() != null
                        ? org.getLarkDefaultRole().getId() : null)
                .redirectUri(larkProperties.getRedirectUri())
                .requiredScopes(REQUIRED_SCOPES)
                .missingRequirements(findMissingRequirements(org).toArray(String[]::new))
                .build();
    }

    /**
     * Nạp tổ chức và chặn truy cập chéo: quyền COMPANY:UPDATE không ràng buộc theo tổ chức nên
     * nếu không kiểm tra, giám đốc công ty này đọc/ghi được credential Lark của công ty khác.
     */
    private Organization loadAuthorized(UUID orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        if (!orgId.equals(getCurrentUserOrgId())) {
            throw new ForbiddenException("Bạn không có quyền truy cập cấu hình của tổ chức này.");
        }
        return org;
    }

    private UUID getCurrentUserOrgId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));

        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (assignments.isEmpty()) {
            throw new ForbiddenException("Người dùng hiện tại không thuộc tổ chức nào.");
        }
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private OrgUnit loadOrgUnitInOrganization(UUID orgUnitId, Organization org) {
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        UUID unitOrgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        if (!unitOrgId.equals(org.getId())) {
            throw new BusinessException("Đơn vị mặc định phải thuộc chính tổ chức này.");
        }
        return unit;
    }

    private Role loadRoleInOrganization(UUID roleId, Organization org) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vai trò", "id", roleId));
        if (role.getOrganization() == null || !role.getOrganization().getId().equals(org.getId())) {
            throw new BusinessException("Vai trò mặc định phải thuộc chính tổ chức này.");
        }
        return role;
    }
}
