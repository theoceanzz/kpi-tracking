package com.kpitracking.service;

import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.dto.request.notification.SaveNotificationConfigRequest;
import com.kpitracking.dto.response.notification.NotificationConfigResponse;
import com.kpitracking.entity.OrgNotificationConfig;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
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
            // Chuỗi duyệt: nhắc người giữ bước khi chờ quá N ngày, và báo admin khi cần gán lại.
            "kpi_approval_reminder",
            "submission_submitted", "submission_reviewed", "submission_escalated", "submission_returned", "reminder_deadline",
            // Đánh giá đợt/kỳ. Trước đây cả mảng này không phát một thông báo nào: đợt hết
            // hạn trong im lặng, chốt xong người bị chấm cũng không hay biết.
            "evaluation_period_due", "evaluation_cycle_due",
            "evaluation_finalized", "cycle_unit_finalized",
            // Khoá kỳ: cycle_locked chỉ đi chuông (diện rộng), cycle_kpi_affected đi cả email
            // cho người có KPI bị chuyển kỳ/bị chốt và trưởng đơn vị của họ.
            "cycle_locked", "cycle_kpi_affected",
            "bsc_scorecard_submitted", "bsc_scorecard_approved", "bsc_scorecard_rejected",
            "bsc_scorecard_activated", "bsc_cascaded",
            "bsc_unit_result_finalized", "bsc_score_overridden",
            // Quy chế chấm AI theo đơn vị: cấp dưới đề nghị đổi tài liệu cấp trên đã áp.
            "ai_criteria_change_requested", "ai_criteria_change_decided",
            // Thư viện tài liệu: có người chia sẻ tài liệu cho bạn (hoặc cho đơn vị của bạn).
            "document_shared", "document_promotion_requested", "document_promotion_decided", "document_review_due",
            // Điểm thưởng
            "reward_grant_submitted", "reward_grant_approved", "reward_grant_rejected",
            "reward_grant_cancelled", "reward_points_received", "reward_grant_revoked",
            "reward_budget_assigned", "reward_program_issued", "reward_program_reverted",
            "reward_redemption_created", "reward_redemption_approved", "reward_redemption_rejected",
            "reward_redemption_delivered", "reward_redemption_failed", "reward_redemption_cancelled",
            // Ví tiền. Hai mã đầu đã chạy từ trước nhưng chưa từng có mặt trong danh sách này,
            // nghĩa là không tổ chức nào tắt được chúng dù giao diện cấu hình vẫn hứa là tắt được.
            "wallet_topup_paid", "wallet_topup_expired", "wallet_topup_unmatched", "wallet_converted",
            // Đánh giá 360
            "f360_rate_request", "f360_reminder", "f360_report_released", "f360_nomination", "f360_declined",
            // Thảo luận trên KPI / công việc: bình luận mới chỉ đi chuông (gộp), trả lời / được nhắc tên đi cả email gộp.
            "discussion_comment", "discussion_reply", "discussion_mention",
            // Công việc gắn KPI: nhắc trước hạn 1 ngày, quá hạn, KPI của việc đã được thay thế.
            "task_due_soon", "task_overdue", "task_kpi_replaced",
            // Công việc kiểu Lark: được giao / giao lại, được thêm theo dõi, việc mình liên quan đổi hạn / trạng thái (gộp).
            "task_assigned", "task_follower_added", "task_changed"
    );

    private final OrgNotificationConfigRepository configRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.security.PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    private UUID getCurrentUserOrgId() {
        User user = getCurrentUser();
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) {
            throw new ResourceNotFoundException(Terms.of("resource.organization"), "user", user.getEmail());
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
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_CHANGE_ORGANIZATION_NOTIFICATION_SETTINGS);
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
