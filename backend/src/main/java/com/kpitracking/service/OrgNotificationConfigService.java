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
            "submission_submitted", "submission_reviewed", "reminder_deadline"
    );

    private final OrgNotificationConfigRepository configRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

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
