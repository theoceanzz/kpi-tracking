package com.kpitracking.service;

import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Resolves the KPI "manager context" for the currently authenticated user — the
 * org unit they lead (or deputy-lead) plus its path and owning organization.
 * Shared by {@link AiService}, the Insight Engine and the Followup Service so the
 * manager-only scoping logic lives in exactly one place.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ManagerContextResolver {

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    /** userId cần cho việc lọc tool theo quyền ở {@code ToolRegistry}. */
    public record ManagerContext(UUID orgUnitId, String orgUnitPath, UUID orgId, String email, UUID userId) {}

    /**
     * @return the manager context for the current user, or {@code null} if the user
     *         is not a leader/deputy (role rank ≤ 1) of any unit.
     */
    /**
     * Ngữ cảnh cho NGƯỜI BẤT KỲ có ít nhất một phân công (kể cả nhân viên thường): đơn vị chính là
     * phân công có hạng cao nhất. Dùng cho lượt chat của nhân viên — cùng hình dạng với ngữ cảnh
     * quản lý để tool đọc được {@code orgUnitPath}, nhưng lượt đó chỉ được nhóm tool CÁ NHÂN.
     *
     * @return {@code null} khi người dùng không thuộc đơn vị nào
     */
    public ManagerContext resolveMember() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;
            return userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                    .filter(a -> a.getOrgUnit() != null && a.getRole() != null)
                    .min(Comparator.comparingInt(a -> a.getRole().getRank() == null ? Integer.MAX_VALUE : a.getRole().getRank()))
                    .map(a -> new ManagerContext(
                            a.getOrgUnit().getId(),
                            a.getOrgUnit().getPath(),
                            a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId(),
                            user.getEmail(),
                            user.getId()))
                    .orElse(null);
        } catch (Exception e) {
            log.error("Error getting member context", e);
            return null;
        }
    }

    public ManagerContext resolve() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            return assignments.stream()
                    .filter(a -> a.getRole().getRank() != null && a.getRole().getRank() <= 1)
                    .min(Comparator.comparingInt(a -> a.getRole().getRank()))
                    .map(a -> new ManagerContext(
                            a.getOrgUnit().getId(),
                            a.getOrgUnit().getPath(),
                            a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId(),
                            user.getEmail(),
                            user.getId()
                    ))
                    .orElse(null);
        } catch (Exception e) {
            log.error("Error getting manager context", e);
            return null;
        }
    }
}
