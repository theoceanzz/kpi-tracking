package com.kpitracking.service.analytics;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Phân giải phạm vi (cây đơn vị + kỳ) dùng chung cho các service thống kê scope theo đánh giá
 * (BSC, Ma trận…). Rút ra để không lặp logic subtree/permission ở nhiều nơi.
 *
 * <p>Giống {@code OrgUnitKpiAnalyticsService.resolveOrgUnitSubtree}: có {@code orgUnitId} thì validate
 * đơn vị thuộc org của người dùng rồi lấy subtree; không có thì lấy các gốc user có quyền
 * {@code DASHBOARD:VIEW} (fallback: đơn vị được phân công). Kỳ: dùng tập được chọn, hoặc toàn bộ kỳ
 * của org khi không chọn.
 */
@Component
@RequiredArgsConstructor
public class AnalyticsScopeResolver {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final KpiPeriodRepository kpiPeriodRepository;

    /** Đơn vị (subtree) + kỳ hiệu lực + org của người dùng hiện tại. */
    public record Scope(List<UUID> unitIds, List<UUID> periodIds, UUID orgId) {
        public boolean isEmpty() { return unitIds.isEmpty() || periodIds.isEmpty(); }
    }

    public Scope resolve(UUID orgUnitId, Collection<UUID> periodIds) {
        User user = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(user);
        List<OrgUnit> units = resolveOrgUnitSubtree(orgUnitId, user, orgId);
        List<UUID> unitIds = units.stream().map(OrgUnit::getId).toList();
        List<UUID> effPeriods = (periodIds != null && !periodIds.isEmpty())
                ? new ArrayList<>(periodIds)
                : (orgId != null ? kpiPeriodRepository.findIdsByOrganizationId(orgId) : Collections.emptyList());
        return new Scope(unitIds, effPeriods, orgId);
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private List<OrgUnit> resolveOrgUnitSubtree(UUID orgUnitId, User user, UUID orgId) {
        if (orgUnitId != null) {
            Optional<OrgUnit> root = orgUnitRepository.findById(orgUnitId);
            if (root.isEmpty()) return Collections.emptyList();
            if (!root.get().getOrgHierarchyLevel().getOrganization().getId().equals(orgId)) {
                return Collections.emptyList();
            }
            return orgUnitRepository.findSubtree(root.get().getPath(), orgId);
        }
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(user.getId(), "DASHBOARD:VIEW");
        if (rootIds.isEmpty()) {
            rootIds = userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                    .map(a -> a.getOrgUnit().getId()).distinct().toList();
        }
        if (rootIds.isEmpty()) return Collections.emptyList();
        return orgUnitRepository.findAllInSubtrees(rootIds, orgId);
    }
}
