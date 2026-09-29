package com.kpitracking.service.feedback360;

import com.kpitracking.entity.*;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Ai xem / ghi được gì trong đánh giá 360 (§6.2). Mọi service 360 đi qua đây thay vì tự kiểm quyền.
 *
 * <p>Luật quan trọng nhất: <b>người được đánh giá không đi đường tắt qua quyền quản lý</b>. Trưởng
 * đơn vị có {@code FEEDBACK360:VIEW} trên chính đơn vị mình, HR có {@code FEEDBACK360:MANAGE} cũng
 * có thể là người được đánh giá — nhưng với subject là chính mình, họ chỉ đi đường
 * {@code VIEW_MY} + chiến dịch đã công bố, và MỌI thao tác ghi nhắm vào chính mình đều bị 403.
 */
@Component
@RequiredArgsConstructor
public class F360AccessPolicy {

    public static final String MANAGE = "FEEDBACK360:MANAGE";
    public static final String VIEW = "FEEDBACK360:VIEW";
    public static final String VIEW_MY = "FEEDBACK360:VIEW_MY";

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;

    public User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    /** Các tổ chức người dùng đang có phân công. */
    public Set<UUID> organizationsOf(User user) {
        return userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(Objects::nonNull)
                .map(PermissionChecker::organizationIdOf)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** Người dùng phải thuộc tổ chức đó — tổ chức lấy theo id client gửi lên nên không tin được. */
    public void requireMember(User user, UUID organizationId) {
        if (organizationId == null || !organizationsOf(user).contains(organizationId)) {
            throw new ForbiddenException(ErrorCode.DO_NOT_BELONG_ORGANIZATION_2);
        }
    }

    /** Tổ chức phải bật đánh giá 360. */
    public void requireEnabled(Organization org) {
        if (org == null || !Boolean.TRUE.equals(org.getEnableFeedback360())) {
            throw new ForbiddenException(ErrorCode.ORGANIZATION_NOT_ENABLED_F360_FEEDBACK);
        }
    }

    public boolean canManage(User user, UUID organizationId) {
        return permissionChecker.hasPermission(user.getId(), MANAGE)
                && organizationsOf(user).contains(organizationId);
    }

    /** Quyền quản trị chiến dịch: có MANAGE, thuộc đúng tổ chức, tổ chức đang bật 360. */
    public void requireManage(User user, Organization org) {
        requireEnabled(org);
        if (!canManage(user, org.getId())) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_ADMINISTER_F360_FEEDBACK);
        }
    }

    /** Có thể xem danh sách/tiến độ chiến dịch (MANAGE hoặc VIEW) trong tổ chức. */
    public boolean canViewCampaigns(User user, UUID organizationId) {
        return organizationsOf(user).contains(organizationId)
                && permissionChecker.hasAnyPermission(user.getId(), MANAGE, VIEW);
    }

    /**
     * Người quản lý (không phải HR) có thấy subject này trong phạm vi của mình không. KHÔNG tính
     * chính mình — dòng của chính người xem luôn bị lọc khỏi danh sách quản lý (§6.2).
     */
    public boolean inManagerScope(User user, F360Subject subject) {
        if (isSelf(user, subject)) return false;
        if (canManage(user, subject.getCampaign().getOrganization().getId())) return true;
        OrgUnit unit = subject.getOrgUnit();
        return unit != null && permissionChecker.hasPermissionInOrgUnit(user.getId(), VIEW, unit.getId());
    }

    public boolean isSelf(User user, F360Subject subject) {
        return subject.getUser() != null && subject.getUser().getId().equals(user.getId());
    }

    /**
     * Xem báo cáo của một subject.
     * <ul>
     *   <li>Chính mình: CHỈ khi có VIEW_MY, chiến dịch đã công bố và cho phép subject xem —
     *       bất kể người đó có VIEW hay MANAGE.</li>
     *   <li>Người khác: MANAGE trong tổ chức, hoặc VIEW trên đơn vị của subject; từ lúc CLOSED.</li>
     * </ul>
     */
    public void requireReportAccess(User user, F360Subject subject) {
        F360Campaign campaign = subject.getCampaign();
        requireEnabled(campaign.getOrganization());
        if (isSelf(user, subject)) {
            boolean ok = campaign.getStatus() == F360CampaignStatus.RELEASED
                    && Boolean.TRUE.equals(campaign.getReleaseToSubject())
                    && permissionChecker.hasPermission(user.getId(), VIEW_MY);
            if (!ok) throw new ForbiddenException(ErrorCode.F360_REPORT_NOT_PUBLISHED);
            return;
        }
        if (!campaign.getStatus().hasResults()) {
            throw new BusinessException(ErrorCode.CAMPAIGN_NOT_CLOSED_NO_RESULTS);
        }
        if (!inManagerScope(user, subject)) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_F360_REPORT);
        }
    }

    /**
     * Chặn mọi thao tác GHI có đích là subject của chính người gọi (ẩn nhận xét, thêm/gỡ/mở lại
     * phiếu, gỡ subject…). Việc cần làm trên chính mình phải nhờ một quản trị 360 khác.
     */
    public void assertNotSelfTarget(User user, F360Subject subject) {
        if (isSelf(user, subject)) {
            throw new ForbiddenException(ErrorCode.CANNOT_PERFORM_ACTION_OWN_F360_FEEDBACK);
        }
    }
}
