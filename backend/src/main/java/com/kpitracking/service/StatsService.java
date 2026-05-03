package com.kpitracking.service;

import com.kpitracking.dto.response.stats.EmployeeKpiStatsResponse;
import com.kpitracking.dto.response.stats.KpiTaskResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OrgUnitKpiStatsResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.*;

import com.kpitracking.dto.response.PageResponse;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private List<OrgUnit> getAuthorizedOrgUnits(User user, String permissionCode) {
        List<UUID> baseOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(user.getId(), permissionCode);
        if (baseOrgUnitIds.isEmpty()) return Collections.emptyList();
        return orgUnitRepository.findAllInSubtrees(baseOrgUnitIds);
    }

    @Transactional(readOnly = true)
    public OverviewStatsResponse getOverviewStats(java.util.UUID orgUnitId) {
        User currentUser = getCurrentUser();
        List<OrgUnit> authorizedUnits = getAuthorizedOrgUnits(currentUser, "DASHBOARD:VIEW");
        
        if (orgUnitId != null) {
            authorizedUnits = authorizedUnits.stream()
                    .filter(u -> u.getId().equals(orgUnitId))
                    .toList();
        }

        if (authorizedUnits.isEmpty()) {
            return OverviewStatsResponse.builder().build();
        }

        // Aggregate stats for authorized units
        List<UUID> unitIds = authorizedUnits.stream().map(OrgUnit::getId).toList();
        
        // Count distinct subordinates (respecting rank hierarchy)
        List<UserRoleOrgUnit> currentUserAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        Integer currentUserRank = currentUserAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds);
        int totalPersonnelCount = (int) assignments.stream()
                .filter(a -> !permissionChecker.isGlobalAdmin(a.getUser().getId()))
                .map(UserRoleOrgUnit::getUser)
                .map(User::getId)
                .distinct()
                .count();

        long pendingSub = submissionRepository.countByOrgUnitIdInAndStatus(unitIds, SubmissionStatus.PENDING);
        long approvedSub = submissionRepository.countByOrgUnitIdInAndStatus(unitIds, SubmissionStatus.APPROVED);
        long rejectedSub = submissionRepository.countByOrgUnitIdInAndStatus(unitIds, SubmissionStatus.REJECTED);

        return OverviewStatsResponse.builder()
                .totalUsers(totalPersonnelCount)
                .totalOrgUnits((int) authorizedUnits.stream().filter(u -> u.getParent() != null).count())
                .totalKpiCriteria(kpiCriteriaRepository.countByOrgUnitIdIn(unitIds))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.REJECTED))
                .draftKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.DRAFT))
                .totalSubmissions((int) (pendingSub + approvedSub + rejectedSub))
                .pendingSubmissions((int) pendingSub)
                .approvedSubmissions((int) approvedSub)
                .rejectedSubmissions((int) rejectedSub)
                .totalEvaluations(evaluationRepository.countByOrgUnitIdIn(unitIds))
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        User currentUser = getCurrentUser();
        List<OrgUnit> authorizedUnits = getAuthorizedOrgUnits(currentUser, "ORG:VIEW");

        return authorizedUnits.stream().map(unit -> OrgUnitKpiStatsResponse.builder()
                .orgUnitId(unit.getId())
                .orgUnitName(unit.getName())
                .parentOrgUnitId(unit.getParent() != null ? unit.getParent().getId() : null)
                .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitId(unit.getId()))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.REJECTED))
                .totalSubmissions(
                    submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.APPROVED) +
                    submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.PENDING) +
                    submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.REJECTED)
                )
                .approvedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.REJECTED))
                .build()
        ).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<EmployeeKpiStatsResponse> getEmployeeKpiStats(int page, int size, java.util.UUID orgUnitId) {
        User currentUser = getCurrentUser();
        List<OrgUnit> authorizedUnits = getAuthorizedOrgUnits(currentUser, "DASHBOARD:VIEW");
        
        if (orgUnitId != null) {
            authorizedUnits = authorizedUnits.stream()
                    .filter(u -> u.getId().equals(orgUnitId))
                    .toList();
        }
        
        if (authorizedUnits.isEmpty()) {
            return PageResponse.<EmployeeKpiStatsResponse>builder()
                    .content(Collections.emptyList())
                    .totalElements(0L)
                    .totalPages(0)
                    .build();
        }

        List<UUID> unitIds = authorizedUnits.stream().map(OrgUnit::getId).toList();
        List<UserRoleOrgUnit> unitAssignments = userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds);
        
        List<User> allUsers = unitAssignments.stream()
                .map(UserRoleOrgUnit::getUser)
                .distinct()
                .toList();

        // Calculate current user rank once
        List<UserRoleOrgUnit> currentUserAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        Integer currentUserRank = currentUserAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        List<EmployeeKpiStatsResponse> allStats = new ArrayList<>();

        Map<UUID, UserRoleOrgUnit> primaryAssignmentMap = new HashMap<>();
        for (UserRoleOrgUnit uro : unitAssignments) {
            UUID userId = uro.getUser().getId();
            UserRoleOrgUnit existing = primaryAssignmentMap.get(userId);
            
            if (existing == null || uro.getOrgUnit().getOrgHierarchyLevel().getLevelOrder() > 
                                   existing.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()) {
                primaryAssignmentMap.put(userId, uro);
            }
        }

        for (User u : allUsers) {
             UserRoleOrgUnit primary = primaryAssignmentMap.get(u.getId());
             if (primary == null) continue;

             // Filter by rank: Deputy (1) only sees Staff (> 1)
             if (currentUserRank == 1 && primary.getRole().getRank() != null && primary.getRole().getRank() <= 1) {
                 continue;
             }

             if (u.getId().equals(currentUser.getId())) {
                 continue; // Exclude self
             }
             // Exclude users with SYSTEM:ADMIN if current user is not a global admin
             if (!permissionChecker.isGlobalAdmin(currentUser.getId()) && permissionChecker.isGlobalAdmin(u.getId())) {
                 continue;
             }
             String roleName = primary.getRole().getName();
             String orgUnitName = primary.getOrgUnit().getName();

             java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT);
             long assignedKpi = kpiCriteriaRepository.countByAssigneeAndStatusIn(u.getId(), activeStatuses);
             
             // Fetch criteria to check submission status per criteria
             List<KpiCriteria> employeeCriteria = kpiCriteriaRepository.findByUserIdInAssignees(u.getId(), activeStatuses, Pageable.unpaged()).getContent();
             long completedKpiCount = 0;
             long totalSub = 0;
             long approvedSub = 0;
             long pendingSub = 0;
             long rejectedSub = 0;
             long lateCount = 0;
             Instant now = Instant.now();

             for (KpiCriteria criteria : employeeCriteria) {
                 long criteriaPending = submissionRepository.countByKpiCriteriaIdAndSubmittedByIdAndStatusAndDeletedAtIsNull(criteria.getId(), u.getId(), SubmissionStatus.PENDING);
                 long criteriaApproved = submissionRepository.countByKpiCriteriaIdAndSubmittedByIdAndStatusAndDeletedAtIsNull(criteria.getId(), u.getId(), SubmissionStatus.APPROVED);
                 long criteriaRejected = submissionRepository.countByKpiCriteriaIdAndSubmittedByIdAndStatusAndDeletedAtIsNull(criteria.getId(), u.getId(), SubmissionStatus.REJECTED);
                 
                 long criteriaTotalNonDraft = criteriaPending + criteriaApproved + criteriaRejected;
                 if (criteriaTotalNonDraft > 0) {
                     completedKpiCount++;
                 }

                 totalSub += criteriaTotalNonDraft;
                 approvedSub += criteriaApproved;
                 pendingSub += criteriaPending;
                 rejectedSub += criteriaRejected;

                 Instant deadline = criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getEndDate() : null;
                 if (criteriaTotalNonDraft == 0 && deadline != null && deadline.isBefore(now)) {
                     lateCount++;
                 }
             }

             Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

             allStats.add(EmployeeKpiStatsResponse.builder()
                     .userId(u.getId())
                     .fullName(u.getFullName())
                     .email(u.getEmail())
                     .role(roleName)
                     .orgUnitName(orgUnitName)
                     .assignedKpi(assignedKpi)
                     .rank(primary.getRole().getRank())
                     .totalSubmissions(totalSub)
                     .approvedSubmissions(completedKpiCount) // Use completed criteria count for the progress display
                     .pendingSubmissions(pendingSub)
                     .rejectedSubmissions(rejectedSub)
                     .lateSubmissions(lateCount)
                     .averageScore(avgScore != null ? avgScore : 0.0)
                     .build());
        }

        allStats.sort((a, b) -> Long.compare(b.getApprovedSubmissions(), a.getApprovedSubmissions()));

        int start = Math.min(page * size, allStats.size());
        int end = Math.min(start + size, allStats.size());
        List<EmployeeKpiStatsResponse> pagedContent = allStats.subList(start, end);

        return PageResponse.<EmployeeKpiStatsResponse>builder()
                .content(pagedContent)
                .page(page)
                .size(size)
                .totalElements(allStats.size())
                .totalPages((int) Math.ceil((double) allStats.size() / size))
                .last(end >= allStats.size())
                .build();
    }

    @Transactional(readOnly = true)
    public MyKpiProgressResponse getMyKpiProgress(int page, int size) {
        User currentUser = getCurrentUser();
        return getUserKpiProgress(currentUser.getId(), page, size);
    }

    @Transactional(readOnly = true)
    public MyKpiProgressResponse getUserKpiProgress(UUID userId, int page, int size) {
        User currentUser = getCurrentUser();
        
        // 0. Permission check
        if (!currentUser.getId().equals(userId)) {
            // Check if current user is global admin or has USER:VIEW in target user's org units
            if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
                List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
                boolean hasAccess = targetUserAssignments.stream()
                        .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW", a.getOrgUnit().getId()));
                
                if (!hasAccess) {
                    throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xem tiến độ của nhân viên này");
                }
            }
        }

        // 1. Basic counts
        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT);
        long totalAssigned = kpiCriteriaRepository.countByAssigneeAndStatusIn(userId, activeStatuses);
        long approved = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED);
        long pending = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING);
        long rejected = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED);
        long totalSubmissions = approved + pending + rejected;
        Double avgScore = evaluationRepository.avgScoreByUserId(userId);

        // 2. Fetch detailed tasks
        List<KpiCriteria> assignedCriteria = kpiCriteriaRepository.findByUserIdInAssignees(userId, activeStatuses, Pageable.unpaged()).getContent();
        List<KpiSubmission> mySubmissions = submissionRepository.findBySubmittedById(userId, Pageable.unpaged()).getContent()
                .stream()
                .filter(s -> s.getStatus() != SubmissionStatus.DRAFT)
                .toList();

        List<KpiTaskResponse> allTasks = new ArrayList<>();
        long lateCount = 0;
        Instant now = Instant.now();

        for (KpiCriteria criteria : assignedCriteria) {
            if (!activeStatuses.contains(criteria.getStatus())) continue;

            // Find submissions for this criteria
            List<KpiSubmission> criteriaSubs = mySubmissions.stream()
                    .filter(s -> s.getKpiCriteria().getId().equals(criteria.getId()))
                    .toList();

            boolean isApproved = criteriaSubs.stream().anyMatch(s -> s.getStatus() == SubmissionStatus.APPROVED);
            boolean isPending = criteriaSubs.stream().anyMatch(s -> s.getStatus() == SubmissionStatus.PENDING);
            boolean isRejected = criteriaSubs.stream().anyMatch(s -> s.getStatus() == SubmissionStatus.REJECTED);

            String status = "NOT_STARTED";
            if (isApproved) status = "APPROVED";
            else if (isPending) status = "PENDING";
            else if (isRejected) status = "REJECTED";

            Instant deadline = criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getEndDate() : null;
            Instant actualDeadline = deadline;
            if (deadline != null && criteria.getKpiPeriod() != null && criteria.getKpiPeriod().getStartDate() != null) {
                long start = criteria.getKpiPeriod().getStartDate().toEpochMilli();
                long end = deadline.toEpochMilli();
                int totalExpected = criteria.getExpectedSubmissions() != null ? criteria.getExpectedSubmissions() : calculateExpectedSubmissions(criteria);
                int currentSub = criteriaSubs.size();
                
                if (currentSub < totalExpected) {
                    long duration = end - start;
                    long subDuration = duration / totalExpected;
                    actualDeadline = Instant.ofEpochMilli(start + (currentSub + 1) * subDuration);
                }
            }

            if (status.equals("NOT_STARTED") && actualDeadline != null && actualDeadline.isBefore(now)) {
                status = "OVERDUE";
                lateCount++;
            }

            allTasks.add(KpiTaskResponse.builder()
                    .id(criteria.getId())
                    .name(criteria.getName())
                    .periodName(criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getName() : "N/A")
                    .deadline(actualDeadline)
                    .status(status)
                    .submissionCount(criteriaSubs.size())
                    .expectedSubmissions(criteria.getExpectedSubmissions() != null ? criteria.getExpectedSubmissions() : calculateExpectedSubmissions(criteria))
                    .build());
        }

        // Sort tasks: OVERDUE first, then NOT_STARTED, then PENDING, then APPROVED
        allTasks.sort((a, b) -> {
            int scoreA = getTaskPriority(a.getStatus());
            int scoreB = getTaskPriority(b.getStatus());
            if (scoreA != scoreB) return Integer.compare(scoreA, scoreB);
            if (a.getDeadline() != null && b.getDeadline() != null) {
                return a.getDeadline().compareTo(b.getDeadline());
            }
            return 0;
        });

        // 4. Paginate
        int start = Math.min(page * size, allTasks.size());
        int end = Math.min(start + size, allTasks.size());
        List<KpiTaskResponse> pagedTasks = allTasks.subList(start, end);

        PageResponse<KpiTaskResponse> taskPage = PageResponse.<KpiTaskResponse>builder()
                .content(pagedTasks)
                .page(page)
                .size(size)
                .totalElements(allTasks.size())
                .totalPages((int) Math.ceil((double) allTasks.size() / size))
                .last(end >= allTasks.size())
                .build();

        return MyKpiProgressResponse.builder()
                .totalAssignedKpi(totalAssigned)
                .totalSubmissions(totalSubmissions)
                .approvedSubmissions(approved)
                .pendingSubmissions(pending)
                .rejectedSubmissions(rejected)
                .lateSubmissions(lateCount)
                .averageScore(avgScore)
                .tasks(taskPage)
                .build();
    }

    private int calculateExpectedSubmissions(KpiCriteria kpi) {
        if (kpi.getFrequency() == null || kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getPeriodType() == null) {
            return 1;
        }
        
        com.kpitracking.enums.KpiFrequency kpiFreq = kpi.getFrequency();
        com.kpitracking.enums.KpiFrequency periodType = kpi.getKpiPeriod().getPeriodType();
        
        if (kpiFreq == periodType) return 1;
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.DAILY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 30;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 90;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 365;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.WEEKLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 4;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 13;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 52;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.MONTHLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 3;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 12;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.QUARTERLY && periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 4;
        return 1;
    }

    private int getTaskPriority(String status) {
        return switch (status) {
            case "OVERDUE" -> 0;
            case "NOT_STARTED" -> 1;
            case "PENDING" -> 2;
            case "APPROVED" -> 3;
            default -> 4;
        };
    }
}
