package com.kpitracking.service;

import com.kpitracking.dto.request.notification.SaveNotificationConfigRequest;
import com.kpitracking.dto.response.notification.NotificationConfigResponse;
import com.kpitracking.entity.OrgNotificationConfig;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrgNotificationConfigRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrgNotificationConfigService {

    private static final List<String> ALL_EVENT_CODES = List.of(
            "kpi_submitted", "kpi_assigned", "kpi_approved", "kpi_rejected", "kpi_approval_reverted",
            "submission_submitted", "submission_reviewed", "submission_escalated", "reminder_deadline",
            // Đánh giá đợt/kỳ. Trước đây cả mảng này không phát một thông báo nào: đợt hết
            // hạn trong im lặng, chốt xong người bị chấm cũng không hay biết.
            "evaluation_period_due", "evaluation_cycle_due",
            "evaluation_finalized", "cycle_unit_finalized",
            "bsc_scorecard_submitted", "bsc_scorecard_approved", "bsc_scorecard_rejected",
            "bsc_scorecard_activated", "bsc_scorecard_locked", "bsc_cascaded",
            "bsc_unit_result_finalized", "bsc_score_overridden",
            // Điểm thưởng
            "reward_grant_submitted", "reward_grant_approved", "reward_grant_rejected",
            "reward_grant_cancelled", "reward_points_received", "reward_grant_revoked",
            "reward_budget_assigned", "reward_program_issued", "reward_program_reverted",
            "reward_redemption_created", "reward_redemption_approved", "reward_redemption_rejected",
            "reward_redemption_delivered", "reward_redemption_failed", "reward_redemption_cancelled",
            // Ví tiền. Hai mã đầu đã chạy từ trước nhưng chưa từng có mặt trong danh sách này,
            // nghĩa là không tổ chức nào tắt được chúng dù giao diện cấu hình vẫn hứa là tắt được.
            "wallet_topup_paid", "wallet_topup_expired", "wallet_topup_unmatched", "wallet_converted"
    );

    private final OrgNotificationConfigRepository configRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.security.PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private UUID getCurrentUserOrgId() {
        User user = getCurrentUser();
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) {
            throw new ResourceNotFoundException("Tổ chức", "user", user.getEmail());
        }
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @Transactional(readOnly = true)
    public List<NotificationConfigResponse> getMyOrgConfigs() {
        UUID orgId = getCurrentUserOrgId();
        return buildConfigList(orgId);
    }

    @Transactional(readOnly = true)
    public List<NotificationConfigResponse> getConfigsForOrg(UUID orgId) {
        return buildConfigList(orgId);
    }

    private List<NotificationConfigResponse> buildConfigList(UUID orgId) {
        Map<String, OrgNotificationConfig> existing = configRepository.findByOrganizationId(orgId)
                .stream()
                .collect(Collectors.toMap(OrgNotificationConfig::getEventCode, Function.identity()));

        return ALL_EVENT_CODES.stream()
                .map(code -> {
                    OrgNotificationConfig cfg = existing.get(code);
                    return NotificationConfigResponse.builder()
                            .eventCode(code)
                            .emailEnabled(cfg == null || cfg.getEmailEnabled())
                            .systemEnabled(cfg == null || cfg.getSystemEnabled())
                            .build();
                })
                .toList();
    }

    @Transactional
    public List<NotificationConfigResponse> saveMyOrgConfigs(SaveNotificationConfigRequest request) {
        UUID orgId = getCurrentUserOrgId();
        // Cấu hình thông báo là của cả tổ chức: nhân viên thường xem được nhưng không được sửa.
        if (!permissionChecker.hasPermissionInOrganization(getCurrentUser().getId(), "COMPANY:UPDATE", orgId)) {
            throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền thay đổi cấu hình thông báo của tổ chức");
        }
        Organization org = new Organization();
        org.setId(orgId);

        for (SaveNotificationConfigRequest.ConfigItem item : request.getConfigs()) {
            Optional<OrgNotificationConfig> existing =
                    configRepository.findByOrganizationIdAndEventCode(orgId, item.getEventCode());

            if (existing.isPresent()) {
                OrgNotificationConfig cfg = existing.get();
                cfg.setEmailEnabled(item.isEmailEnabled());
                cfg.setSystemEnabled(item.isSystemEnabled());
                configRepository.save(cfg);
            } else {
                configRepository.save(OrgNotificationConfig.builder()
                        .organization(org)
                        .eventCode(item.getEventCode())
                        .emailEnabled(item.isEmailEnabled())
                        .systemEnabled(item.isSystemEnabled())
                        .build());
            }
        }

        return buildConfigList(orgId);
    }

    public boolean isEmailEnabled(UUID orgId, String eventCode) {
        return configRepository.findByOrganizationIdAndEventCode(orgId, eventCode)
                .map(OrgNotificationConfig::getEmailEnabled)
                .orElse(true);
    }

    public boolean isSystemEnabled(UUID orgId, String eventCode) {
        return configRepository.findByOrganizationIdAndEventCode(orgId, eventCode)
                .map(OrgNotificationConfig::getSystemEnabled)
                .orElse(true);
    }
}
