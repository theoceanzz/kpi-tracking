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

    public record ManagerContext(UUID orgUnitId, String orgUnitPath, UUID orgId) {}

    /**
     * @return the manager context for the current user, or {@code null} if the user
     *         is not a leader/deputy (role rank ≤ 1) of any unit.
     */
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
                            a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId()
                    ))
                    .orElse(null);
        } catch (Exception e) {
            log.error("Error getting manager context", e);
            return null;
        }
    }
}
