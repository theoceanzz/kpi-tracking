package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.stats.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.analytics.KpiMetricsCalculator;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final PermissionChecker permissionChecker;
    private final EvaluationService evaluationService;
    private final OrganizationService organizationService;

    /**
     * Hiệu suất ĐÁNH GIÁ của 1 đơn vị: không thác nước = TB đánh giá của mọi người trong đơn vị (subtree);
     * có thác nước = đánh giá của quản lý đơn vị đó. Tính trên các đợt của KPI thuộc đơn vị. 0 nếu không có.
     */
    private double unitEvaluationPerformance(OrgUnit unit, java.util.Collection<UUID> selectedPeriodIds) {
        // Nguồn chung: công thức hiệu suất ĐÁNH GIÁ cấp đơn vị đã dời về EvaluationService
        // để analytics, Insight (AI) và chatbot dùng chung một định nghĩa.
        return evaluationService.unitEvaluationPerformance(unit, selectedPeriodIds);
    }

    /**
     * Giữ lại các KPI thuộc đúng đợt {@code periodId}. Khi {@code periodId == null} trả nguyên danh
     * sách (không lọc). Dùng {@code getId()} trên association (không init proxy) nên an toàn kể cả khi
     * đợt đã soft-delete.
     */
    private List<KpiCriteria> filterByPeriod(List<KpiCriteria> kpis, java.util.Collection<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return kpis;
        return kpis.stream()
                .filter(k -> k.getKpiPeriod() != null && periodIds.contains(k.getKpiPeriod().getId()))
                .toList();
    }

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
        UUID orgId = getCurrentUserOrganizationId(user);
        return orgUnitRepository.findAllInSubtrees(baseOrgUnitIds, orgId);
    }

    private long countPendingKpiForApproval(User currentUser, UUID organizationId) {
        if (organizationId == null) return 0L;

        com.kpitracking.security.PermissionChecker.KpiVisibilityScope scope =
                permissionChecker.getKpiVisibilityScope(currentUser.getId());
        if (scope.isEmpty()) return 0L;

        UUID excludeUserId = permissionChecker.hasPermission(currentUser.getId(), "KPI:REVERT_APPROVAL")
                ? null
                : currentUser.getId();
        com.kpitracking.enums.KpiType kpiTypeFilter = organizationService.isQualitativeEnabled(organizationId)
                ? null
                : com.kpitracking.enums.KpiType.QUANTITATIVE;

        return kpiCriteriaRepository.countPendingApprovalVisibleTo(organizationId,
                scope.managerUnitIdsForQuery(), scope.memberUnitIdsForQuery(), excludeUserId, kpiTypeFilter);
    }

    @Transactional(readOnly = true)
    public OverviewStatsResponse getOverviewStats(java.util.UUID orgUnitId) {
        User currentUser = getCurrentUser();
        long pendingKpiForApproval = countPendingKpiForApproval(currentUser, getCurrentUserOrganizationId(currentUser));
        List<OrgUnit> authorizedUnits = getAuthorizedOrgUnits(currentUser, "DASHBOARD:VIEW");
        
        if (orgUnitId != null) {
            OrgUnit targetUnit = authorizedUnits.stream().filter(u -> u.getId().equals(orgUnitId)).findFirst().orElse(null);
            if (targetUnit != null) {
                authorizedUnits = authorizedUnits.stream()
                        .filter(u -> u.getPath().startsWith(targetUnit.getPath()))
                        .toList();
            } else {
                authorizedUnits = Collections.emptyList();
            }
        }

        if (authorizedUnits.isEmpty()) {
            return OverviewStatsResponse.builder().pendingKpiForApproval(pendingKpiForApproval).build();
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

        long pendingSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatusExcludingUser(unitIds, SubmissionStatus.PENDING, currentUser.getId());
        long approvedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(unitIds, SubmissionStatus.APPROVED);
        long rejectedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(unitIds, SubmissionStatus.REJECTED);

        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.PENDING_APPROVAL);

        List<EvaluationPeriodCountResponse> evaluationPeriods = evaluationRepository.countGroupByPeriodForOrgUnits(unitIds)
                .stream()
                .map(row -> EvaluationPeriodCountResponse.builder()
                        .kpiPeriodId((UUID) row[0])
                        .kpiPeriodName((String) row[1])
                        .count(((Number) row[2]).longValue())
                        .build())
                .toList();

        return OverviewStatsResponse.builder()
                .totalUsers(totalPersonnelCount)
                .totalOrgUnits((int) kpiCriteriaRepository.countDistinctOrgUnitsOfAssigneesIn(unitIds, activeStatuses))
                .totalKpiCriteria(kpiCriteriaRepository.countTotalKpiCriteriaIn(unitIds, activeStatuses))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatusExcludingUser(unitIds, KpiStatus.PENDING_APPROVAL, currentUser.getId()))
                .pendingKpiForApproval(pendingKpiForApproval)
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.REJECTED))
                .draftKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.DRAFT))
                .totalSubmissions((int) (pendingSub + approvedSub + rejectedSub))
                .approvedSubmissions((int) approvedSub)
                .pendingSubmissions((int) pendingSub)
                .rejectedSubmissions((int) rejectedSub)
                .totalEvaluations(evaluationRepository.countByOrgUnitIdIn(unitIds))
                .evaluationPeriods(evaluationPeriods)
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        // Get all units that the user has dashboard view access to, including their subtrees
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "DASHBOARD:VIEW");
        List<OrgUnit> authorizedUnits = orgUnitRepository.findAllInSubtrees(rootIds, orgId);

        return authorizedUnits.stream().map(unit -> {
            List<UUID> subtreeIds = getSubtreeIds(unit);
            
            long approvedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(subtreeIds, SubmissionStatus.APPROVED);
            long pendingSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(subtreeIds, SubmissionStatus.PENDING);
            long rejectedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(subtreeIds, SubmissionStatus.REJECTED);
            long totalSub = approvedSub + pendingSub + rejectedSub;

            java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.PENDING_APPROVAL);

            return OrgUnitKpiStatsResponse.builder()
                .orgUnitId(unit.getId())
                .orgUnitName(unit.getName())
                .parentOrgUnitId(unit.getParent() != null ? unit.getParent().getId() : null)
                .memberCount(userRoleOrgUnitRepository.findByOrgUnitIdIn(subtreeIds).stream().map(uro -> uro.getUser().getId()).distinct().toList().size())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(subtreeIds))
                .totalAssignments(kpiCriteriaRepository.countTotalAssignmentsIn(subtreeIds, activeStatuses))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.REJECTED))
                .totalSubmissions((int) totalSub)
                .approvedSubmissions(approvedSub)
                .pendingSubmissions(pendingSub)
                .rejectedSubmissions(rejectedSub)
                .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<EmployeeKpiStatsResponse> getEmployeeKpiStats(int page, int size, java.util.UUID orgUnitId) {
        User currentUser = getCurrentUser();
        List<OrgUnit> authorizedUnits = getAuthorizedOrgUnits(currentUser, "DASHBOARD:VIEW");
        
        if (orgUnitId != null) {
            OrgUnit targetUnit = authorizedUnits.stream().filter(u -> u.getId().equals(orgUnitId)).findFirst().orElse(null);
            if (targetUnit != null) {
                authorizedUnits = authorizedUnits.stream()
                        .filter(u -> u.getPath().startsWith(targetUnit.getPath()))
                        .toList();
            } else {
                authorizedUnits = Collections.emptyList();
            }
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

             int targetRoleLevel = primary.getOrgUnit().getOrgHierarchyLevel().getRoleLevel();
             // Hierarchy-based filtering (Simple Numeric Logic)
             if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
                 // Find the MOST POWERFUL assignment I have for this context (lowest level, then lowest rank)
                 UserRoleOrgUnit myPrimary = currentUserAssignments.stream()
                         .filter(a -> u.getId().equals(currentUser.getId()) || primary.getOrgUnit().getPath().startsWith(a.getOrgUnit().getPath()))
                         .sorted(java.util.Comparator.comparingInt((UserRoleOrgUnit a) -> a.getOrgUnit().getOrgHierarchyLevel().getLevelOrder())
                                 .thenComparingInt(a -> a.getRole().getRank()))
                         .findFirst().orElse(null);

                 int myLevel = (myPrimary != null) ? myPrimary.getOrgUnit().getOrgHierarchyLevel().getRoleLevel() : 99;
                 int myRank = (myPrimary != null && myPrimary.getRole().getRank() != null) ? myPrimary.getRole().getRank() : 2;

                 Integer targetRank = primary.getRole().getRank();
                 if (targetRank == null) targetRank = 2;

                 System.out.print("DEBUG: [ME: " + currentUser.getFullName() + " (L:" + myLevel + ", R:" + myRank + ")] ");
                 System.out.print("-> [TARGET: " + u.getFullName() + " (L:" + targetRoleLevel + ", R:" + targetRank + ")] ");

                 // 1. Hide people at higher levels (smaller level number)
                 if (targetRoleLevel < myLevel) {
                     System.out.println("SKIPPED (Higher Level)");
                     continue;
                 }
                 
                 // 2. At the same level, hide people with higher position (smaller rank number)
                 if (targetRoleLevel == myLevel && targetRank < myRank) {
                     System.out.println("SKIPPED (Superior Rank)");
                     continue;
                 }
                 
                 // 3. Exclude self
                 if (u.getId().equals(currentUser.getId())) {
                     System.out.println("SKIPPED (Self)");
                     continue;
                 }
                 System.out.println("INCLUDED");
             } else {
                 if (u.getId().equals(currentUser.getId())) continue;
             }
             // Exclude users with SYSTEM:ADMIN if current user is not a global admin
             if (!permissionChecker.isGlobalAdmin(currentUser.getId()) && permissionChecker.isGlobalAdmin(u.getId())) {
                 continue;
             }
             String roleName = primary.getRole().getName();
             String orgUnitName = primary.getOrgUnit().getName();

             java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.PENDING_APPROVAL);
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

                 Instant deadline = criteria.getEffectiveDeadline();
                 if (criteriaTotalNonDraft == 0 && deadline != null && deadline.isBefore(now)) {
                     lateCount++;
                 }
             }

             Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

             allStats.add(EmployeeKpiStatsResponse.builder()
                     .userId(u.getId())
                     .employeeCode(u.getEmployeeCode())
                     .fullName(u.getFullName())
                     .avatarUrl(u.getAvatarUrl())
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
                        .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW", a.getOrgUnit().getId()) ||
                                       permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW_LIST", a.getOrgUnit().getId()));

                
                if (!hasAccess) {
                    throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xem tiến độ của nhân viên này");
                }
            }
        }

        // 1. Basic counts
        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.PENDING_APPROVAL);
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
        long pendingTaskCount = 0;
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
            if (criteria.getStatus() == KpiStatus.EDIT) status = "EDIT";
            else if (isApproved) status = "APPROVED";
            else if (isPending) status = "PENDING";
            else if (isRejected) status = "REJECTED";

            Instant deadline = criteria.getEffectiveDeadline();
            Instant actualDeadline = deadline;
            if (criteria.getFrequency() != com.kpitracking.enums.KpiFrequency.UNLIMITED
                    && deadline != null && criteria.getKpiPeriod() != null && criteria.getKpiPeriod().getStartDate() != null) {
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

            Instant periodStart = criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getStartDate() : null;
            boolean notOpenedYet = periodStart != null && periodStart.isAfter(now);

            if (!notOpenedYet
                    && (status.equals("NOT_STARTED") || status.equals("OVERDUE") || status.equals("REJECTED") || status.equals("EDIT"))) {
                pendingTaskCount++;
            }

            if (status.equals("NOT_STARTED") && actualDeadline != null && actualDeadline.isBefore(now)) {
                status = "OVERDUE";
                lateCount++;
            }

            // 1. Find the best manager score from approved submissions for this specific KPI
            KpiSubmission bestSubmission = criteriaSubs.stream()
                    .filter(s -> s.getStatus() == SubmissionStatus.APPROVED && s.getManagerScore() != null)
                    .max(java.util.Comparator.comparingDouble(KpiSubmission::getManagerScore))
                    .orElse(null);

            Double mScore = null;
            String mName = null;
            Double achievementForCircle = null;

            if (bestSubmission != null) {
                mScore = bestSubmission.getManagerScore();
                mName = bestSubmission.getReviewedBy() != null ? bestSubmission.getReviewedBy().getFullName() : null;
                
                // Calculate achievement rate based on manager score, weight and organization multiplier
                if (criteria.getWeight() != null && criteria.getWeight() > 0) {
                    double multiplier = 1.0;
                    try {
                        Organization org = criteria.getOrgUnit().getOrgHierarchyLevel().getOrganization();
                        if (org.getEvaluationMaxScore() != null) {
                            multiplier = org.getEvaluationMaxScore() / 100.0;
                        }
                    } catch (Exception e) {
                        // Fallback to 1.0 if any association is missing
                    }
                    
                    achievementForCircle = Math.min(100.0, (mScore / (criteria.getWeight() * multiplier)) * 100.0);
                } else {
                    achievementForCircle = mScore;
                }
            }

            allTasks.add(KpiTaskResponse.builder()
                    .id(criteria.getId())
                    .name(criteria.getName())
                    .periodName(criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getName() : "N/A")
                    .deadline(actualDeadline)
                    .startDate(criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getStartDate() : null)
                    .status(status)
                    .submissionCount(criteriaSubs.size())
                    .expectedSubmissions(criteria.getExpectedSubmissions() != null ? criteria.getExpectedSubmissions() : calculateExpectedSubmissions(criteria))
                    .managerScore(achievementForCircle) // Only non-null when manager has scored
                    .managerName(mName)
                    .kpiType(criteria.getKpiType())
                    .qualitativeLevelName(bestSubmission != null && bestSubmission.getQualitativeLevel() != null
                            ? bestSubmission.getQualitativeLevel().getName() : null)
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
                .pendingTaskCount(pendingTaskCount)
                .averageScore(avgScore)
                .tasks(taskPage)
                .build();
    }

    private int calculateExpectedSubmissions(KpiCriteria kpi) {
        if (kpi.getFrequency() == null || kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getPeriodType() == null) {
            return 1;
        }
        if (kpi.getFrequency() == com.kpitracking.enums.KpiFrequency.UNLIMITED) return Integer.MAX_VALUE;

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
    @Transactional(readOnly = true)
    public AnalyticsMyStatsResponse getMyAnalytics(Instant from, Instant to) {
        User currentUser = getCurrentUser();
        UUID userId = currentUser.getId();

        List<KpiCriteria> kpis;
        if (from != null && to != null) {
            kpis = kpiCriteriaRepository.findApprovedByAssigneeIdAndPeriod(userId, from, to);
        } else {
            kpis = kpiCriteriaRepository.findApprovedByAssigneeId(userId);
        }

        List<AnalyticsMyStatsResponse.KpiProgressItem> kpiItems = kpis.stream().map(k -> {
            boolean reverse = Boolean.TRUE.equals(k.getIsReverseKpi());
            Instant f = from != null ? from : Instant.EPOCH;
            Instant t2 = to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS);

            double actualValue;
            double completionRate = 0;
            if (reverse) {
                List<Double> latest = submissionRepository.latestActualValueByUserIdAndKpiIdInPeriod(userId, k.getId(), f, t2, ONE);
                boolean has = !latest.isEmpty() && latest.get(0) != null;
                actualValue = has ? latest.get(0) : 0.0;
                if (has && k.getTargetValue() != null && k.getTargetValue() > 0) {
                    completionRate = Math.round(KpiMetricsCalculator.reversePercent(actualValue, k.getTargetValue()));
                }
            } else {
                actualValue = submissionRepository.sumActualValueByUserIdAndKpiIdInPeriod(userId, k.getId(), f, t2);
                if (k.getTargetValue() != null && k.getTargetValue() > 0) {
                    completionRate = Math.round((actualValue / k.getTargetValue()) * 100);
                }
            }

            return AnalyticsMyStatsResponse.KpiProgressItem.builder()
                    .kpiId(k.getId())
                    .kpiName(k.getName())
                    .unit(k.getUnit())
                    .targetValue(k.getTargetValue())
                    .actualValue(actualValue)
                    .completionRate(completionRate)
                    .status(k.getStatus().name())
                    .orgUnitName(k.getOrgUnit().getName())
                    .build();
        }).toList();

        List<Evaluation> evaluations;
        if (from != null && to != null) {
            evaluations = evaluationRepository.findByUserIdAndPeriod(userId, from, to);
        } else {
            evaluations = evaluationRepository.findAllByUserIdOrdered(userId);
        }

        // Gom đánh giá theo ĐỢT; mỗi đợt 1 dòng, điểm = hiệu suất đánh giá hiệu lực (công thức trước đó).
        Map<UUID, KpiPeriod> periodById = new java.util.LinkedHashMap<>();
        for (Evaluation e : evaluations) {
            if (e.getKpiPeriod() != null) periodById.putIfAbsent(e.getKpiPeriod().getId(), e.getKpiPeriod());
        }
        List<AnalyticsMyStatsResponse.EvaluationItem> evalItems = periodById.values().stream()
            .sorted(Comparator.comparing(KpiPeriod::getStartDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(p -> {
                Evaluation eff = evaluationService.getEffectiveEvaluation(userId, p.getId());
                if (eff == null) return null;
                return AnalyticsMyStatsResponse.EvaluationItem.builder()
                        .id(eff.getId())
                        .kpiName(p.getName())
                        .score(eff.getScore())
                        .comment(eff.getComment())
                        .evaluatorName(eff.getEvaluator() != null ? eff.getEvaluator().getFullName() : null)
                        .createdAt(eff.getCreatedAt())
                        .build();
            })
            .filter(java.util.Objects::nonNull)
            .toList();

        return AnalyticsMyStatsResponse.builder()
                .totalAssignedKpi((long) kpis.size())
                .totalSubmissions(submissionRepository.countBySubmittedById(userId))
                .approvedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED))
                .averageScore(evaluationRepository.avgScoreByUserId(userId))
                .kpiItems(kpiItems)
                .evaluationHistory(evalItems)
                .build();
    }

    @Transactional(readOnly = true)
    public AnalyticsDrillDownResponse getDrillDown(UUID orgUnitId, java.time.Instant from, java.time.Instant to, java.util.Collection<UUID> periodIds) {
        User currentUser = getCurrentUser();
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        if (userRoles.isEmpty()) return AnalyticsDrillDownResponse.builder().build();

        OrgUnit userUnit = userRoles.get(0).getOrgUnit();
        OrgUnit currentOrgUnit = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        if (!currentOrgUnit.getPath().startsWith(userUnit.getPath())) currentOrgUnit = userUnit;

        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(currentOrgUnit.getId());
        List<AnalyticsDrillDownResponse.OrgUnitSummary> childSummaries = childUnits.stream().map(unit -> {
            List<UUID> subtreeIds = getSubtreeIds(unit);
            List<KpiCriteria> unitKpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
            double totalPerformance = 0;
            for (KpiCriteria kpi : unitKpis) {
                totalPerformance += Math.round(kpiUnitPercent(kpi, subtreeIds, from, to));
            }
            return AnalyticsDrillDownResponse.OrgUnitSummary.builder()
                    .orgUnitId(unit.getId())
                    .orgUnitName(unit.getName())
                    .levelName(unit.getOrgHierarchyLevel().getUnitTypeName())
                    .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                    .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedKpi(unitKpis.size())
                    .completionRate(!unitKpis.isEmpty() ? totalPerformance / unitKpis.size() : 0)
                    .performanceRate(unitEvaluationPerformance(unit, periodIds))
                    .totalSubmissions(submissionRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.REJECTED))
                    .hasChildren(!orgUnitRepository.findByParentId(unit.getId()).isEmpty())
                    .build();
        }).toList();

        // Heatmap: only KPIs directly owned by each child unit (not their subtrees)
        List<AnalyticsDrillDownResponse.HeatmapPoint> heatmapData = new ArrayList<>();
        for (OrgUnit child : childUnits) {
            List<UUID> directIds = List.of(child.getId());
            List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(directIds, KpiStatus.APPROVED);
            for (KpiCriteria kpi : kpis) {
                heatmapData.add(AnalyticsDrillDownResponse.HeatmapPoint.builder().x(child.getName()).y(kpi.getName()).value(Math.round(kpiUnitPercent(kpi, directIds, from, to))).build());
            }
        }

        // Thành viên = TẤT CẢ nhân sự trong cây con (đơn vị hiện tại + đơn vị con), KHÔNG chỉ trực tiếp.
        // Mỗi người xuất hiện 1 lần, gán về đơn vị CAO NHẤT (path ngắn nhất) mà họ giữ vai trò; sắp xếp
        // theo đơn vị từ cao xuống thấp (path ngắn → dài) rồi theo tên → đơn vị hiện tại đứng đầu.
        List<UUID> currentSubtree = getSubtreeIds(currentOrgUnit);
        java.util.Map<UUID, UserRoleOrgUnit> byUser = new java.util.LinkedHashMap<>();
        userRoleOrgUnitRepository.findByOrgUnitIdIn(currentSubtree).stream()
                .sorted(java.util.Comparator
                        .comparingInt((UserRoleOrgUnit uro) -> uro.getOrgUnit().getPath() != null ? uro.getOrgUnit().getPath().length() : Integer.MAX_VALUE)
                        .thenComparing(uro -> uro.getUser().getFullName() != null ? uro.getUser().getFullName() : ""))
                .forEach(uro -> byUser.putIfAbsent(uro.getUser().getId(), uro));
        List<UserRoleOrgUnit> members = new ArrayList<>(byUser.values());
        List<AnalyticsDrillDownResponse.EmployeeSummary> employeeSummaries = members.stream().map(m -> {
            User u = m.getUser();
            OrgUnit memberUnit = m.getOrgUnit();
            // Hiệu suất = hiệu suất ĐÁNH GIÁ (per-user), theo đợt đang chọn nếu có, ngược lại gộp mọi đợt KPI của user.
            List<KpiCriteria> userKpis = kpiCriteriaRepository.findApprovedByAssigneeId(u.getId());
            java.util.Set<UUID> evalPeriodIds = (periodIds != null && !periodIds.isEmpty())
                    ? new java.util.LinkedHashSet<>(periodIds)
                    : userKpis.stream().map(KpiCriteria::getKpiPeriod).filter(java.util.Objects::nonNull)
                        .map(KpiPeriod::getId).collect(java.util.stream.Collectors.toSet());
            Double evalPerf = evalPeriodIds.isEmpty() ? null
                    : evaluationService.averagePerformance(java.util.Set.of(u.getId()), evalPeriodIds);
            Double performanceRate = evalPerf != null ? Math.round(evalPerf * 10.0) / 10.0 : null;
            return AnalyticsDrillDownResponse.EmployeeSummary.builder()
                    .userId(u.getId()).fullName(u.getFullName()).avatarUrl(u.getAvatarUrl())
                    .email(u.getEmail()).roleName(m.getRole().getName())
                    .orgUnitId(memberUnit != null ? memberUnit.getId() : null)
                    .orgUnitName(memberUnit != null ? memberUnit.getName() : null)
                    .assignedKpi(kpiCriteriaRepository.countByAssigneeId(u.getId()))
                    .totalSubmissions(submissionRepository.countBySubmittedById(u.getId()))
                    .approvedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByUserId(u.getId()))
                    .performanceRate(performanceRate).build();
        }).toList();

        return AnalyticsDrillDownResponse.builder()
                .orgUnitId(currentOrgUnit.getId()).orgUnitName(currentOrgUnit.getName()).levelName(currentOrgUnit.getOrgHierarchyLevel().getUnitTypeName())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(currentSubtree, KpiStatus.APPROVED))
                .totalSubmissions(submissionRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.REJECTED))
                .memberCount(members.size()).childUnits(childSummaries).employees(employeeSummaries).heatmapData(heatmapData).build();
    }

    @Transactional(readOnly = true)
    public PageResponse<AnalyticsDetailRow> getDetailTable(UUID orgUnitId, String search, int page, int size) {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) return PageResponse.<AnalyticsDetailRow>builder().content(List.of()).build();

        List<User> initialUsers;
        if (orgUnitId != null) {
            OrgUnit unit = orgUnitRepository.findById(orgUnitId).orElse(null);
            if (unit == null) return PageResponse.<AnalyticsDetailRow>builder().content(List.of()).build();
            List<UUID> subtreeIds = getSubtreeIds(unit);
            Set<User> uniqueUsers = new LinkedHashSet<>();
            for (UUID suId : subtreeIds) userRoleOrgUnitRepository.findByOrgUnitId(suId).forEach(m -> uniqueUsers.add(m.getUser()));
            initialUsers = new ArrayList<>(uniqueUsers);
        } else {
            initialUsers = userRoleOrgUnitRepository.findUsersByOrganizationId(orgId);
        }

        List<User> users = initialUsers;
        if (search != null && !search.isBlank()) {
            String lowerSearch = search.toLowerCase();
            users = initialUsers.stream().filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase().contains(lowerSearch)) || (u.getEmail() != null && u.getEmail().toLowerCase().contains(lowerSearch))).toList();
        }

        List<AnalyticsDetailRow> allRows = new ArrayList<>();
        for (User u : users) {
            List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
            long assignedKpi = kpiCriteriaRepository.countByAssigneeId(u.getId());
            
            double sumPct = 0;
            int kpiCnt = 0;
            List<KpiCriteria> userKpis = kpiCriteriaRepository.findApprovedByAssigneeId(u.getId());
            for (KpiCriteria k : userKpis) {
                if (k.getTargetValue() != null && k.getTargetValue() > 0) {
                    sumPct += kpiUserPercent(k, u.getId(), null, null);
                    kpiCnt++;
                }
            }
            double perfRate = kpiCnt > 0 ? Math.round(sumPct / kpiCnt) : 0;

            long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
            allRows.add(AnalyticsDetailRow.builder()
                    .userId(u.getId()).employeeCode(u.getEmployeeCode()).fullName(u.getFullName())
                    .avatarUrl(u.getAvatarUrl()).email(u.getEmail())
                    .orgUnitName(roles.isEmpty() ? null : roles.get(0).getOrgUnit().getName())
                    .roleName(roles.isEmpty() ? "N/A" : roles.get(0).getRole().getName())
                    .assignedKpi(assignedKpi).completedKpi(approvedSub)
                    .completionRate(perfRate)
                    .totalSubmissions(submissionRepository.countBySubmittedById(u.getId()))
                    .approvedSubmissions(approvedSub)
                    .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByUserId(u.getId()))
                    .lastSubmissionDate(submissionRepository.findLatestSubmissionDateByUserId(u.getId())).build());
        }

        allRows.sort((a, b) -> Double.compare(b.getCompletionRate(), a.getCompletionRate()));
        int totalElements = allRows.size();
        int fromIdx = Math.min(page * size, totalElements);
        int toIdx = Math.min(fromIdx + size, totalElements);
        return PageResponse.<AnalyticsDetailRow>builder().content(allRows.subList(fromIdx, toIdx)).page(page).size(size).totalElements(totalElements).totalPages((int) Math.ceil((double) totalElements / size)).last(page >= (int) Math.ceil((double) totalElements / size) - 1).build();
    }

    private List<UUID> getSubtreeIds(OrgUnit unit) {
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath(), orgId);
        return subtree.isEmpty() ? List.of(unit.getId()) : subtree.stream().map(OrgUnit::getId).toList();
    }

    // ── % tiến độ/hiệu suất của 1 KPI (KPI ngược dùng bài nộp mới nhất; KPI thường = actual/target) ──
    private static final org.springframework.data.domain.Pageable ONE = org.springframework.data.domain.PageRequest.of(0, 1);

    private double kpiUnitPercent(KpiCriteria k, List<UUID> orgUnitIds, Instant from, Instant to) {
        double target = k.getTargetValue() != null ? k.getTargetValue() : 0.0;
        if (target <= 0) return 0.0;
        Instant f = from != null ? from : Instant.EPOCH;
        Instant t = to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS);
        // Công thức tiến độ CHUẨN (cap 150% + KPI ngược) — nhất quán với kpiUserPercent / bảng Xếp hạng / Rủi ro.
        if (Boolean.TRUE.equals(k.getIsReverseKpi())) {
            List<Double> latest = submissionRepository.latestActualValueByOrgUnitIdsAndKpiIdInPeriod(orgUnitIds, k.getId(), f, t, ONE);
            if (latest.isEmpty() || latest.get(0) == null) return 0.0;
            return KpiMetricsCalculator.percent(latest.get(0), target, true);
        }
        double actual = submissionRepository.sumActualValueByOrgUnitIdsAndKpiIdInPeriod(orgUnitIds, k.getId(), f, t);
        return KpiMetricsCalculator.percent(actual, target, false);
    }

    private double kpiUserPercent(KpiCriteria k, UUID userId, Instant from, Instant to) {
        double target = k.getTargetValue() != null ? k.getTargetValue() : 0.0;
        if (target <= 0) return 0.0;
        Instant f = from != null ? from : Instant.EPOCH;
        Instant t = to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS);
        // Công thức tiến độ CHUẨN (cap 150% + KPI ngược), gồm APPROVED+PENDING+REJECTED, mốc periodStart ?? createdAt
        // — nhất quán với bảng Rủi ro đơn vị & Rủi ro thành viên.
        boolean reverse = Boolean.TRUE.equals(k.getIsReverseKpi());
        if (reverse) {
            List<Double> latest = submissionRepository.latestActualValueByUserIdAndKpiIdInPeriodAllStatuses(userId, k.getId(), f, t, ONE);
            if (latest.isEmpty() || latest.get(0) == null) return 0.0;
            return KpiMetricsCalculator.percent(latest.get(0), target, true);
        }
        double actual = submissionRepository.sumActualValueByUserIdAndKpiIdInPeriodAllStatuses(userId, k.getId(), f, t);
        return KpiMetricsCalculator.percent(actual, target, false);
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryResponse getSummary(UUID orgUnitId, UUID rankingUnitId, String direction) {
        User currentUser = getCurrentUser();
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        if (userRoles.isEmpty()) return AnalyticsSummaryResponse.builder().build();

        OrgUnit userUnit = userRoles.get(0).getOrgUnit();
        OrgUnit targetUnit = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        if (!targetUnit.getPath().startsWith(userUnit.getPath())) targetUnit = userUnit;

        List<UUID> subtreeIds = getSubtreeIds(targetUnit);
        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(targetUnit.getId());

        // Overview logic
        List<KpiCriteria> allKpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
        // Tiến độ tổng = trung bình % từng KPI (KPI ngược tính theo hướng riêng)
        double sumKpiPct = 0;
        int kpiPctCount = 0;
        for (KpiCriteria kpi : allKpis) {
            sumKpiPct += kpiUnitPercent(kpi, subtreeIds, null, null);
            kpiPctCount++;
        }
        long kpiCompletionRate = kpiPctCount > 0 ? Math.round(sumKpiPct / kpiPctCount) : 0;
        
        long pendingSubs = submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.PENDING);
        List<UserRoleOrgUnit> allMembersRaw = userRoleOrgUnitRepository.findByOrgUnitIdIn(subtreeIds);
        Map<UUID, UserRoleOrgUnit> memberMap = new HashMap<>();
        for (UserRoleOrgUnit m : allMembersRaw) {
            UUID userId = m.getUser().getId();
            UserRoleOrgUnit existing = memberMap.get(userId);
            if (existing == null || m.getOrgUnit().getOrgHierarchyLevel().getLevelOrder() > 
                                   existing.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()) {
                memberMap.put(userId, m);
            }
        }
        Collection<UserRoleOrgUnit> allMembers = memberMap.values();

        // Structure logic — đếm MỖI NGƯỜI 1 LẦN ở đơn vị SÂU NHẤT (memberMap), theo vai trò tại đó.
        // Bucket 0 = ĐƠN VỊ HIỆN TẠI: gồm TOÀN BỘ nhân sự dưới cây (kể cả đơn vị con).
        // Bucket i+1 = từng đơn vị con (breakdown, là tập con của bucket 0).
        int childCount = childUnits.size();
        Map<UUID, Integer> unitToChild = new HashMap<>();
        for (int i = 0; i < childCount; i++) {
            for (UUID id : getSubtreeIds(childUnits.get(i))) unitToChild.put(id, i);
        }
        int bucketCount = childCount + 1;
        long[] bucketTotal = new long[bucketCount];
        List<Map<String, Long>> bucketRoles = new ArrayList<>();
        for (int i = 0; i < bucketCount; i++) bucketRoles.add(new java.util.LinkedHashMap<>());
        for (UserRoleOrgUnit uro : memberMap.values()) {
            String roleName = uro.getRole() != null ? uro.getRole().getName() : "Khác";
            // Đơn vị hiện tại: cộng mọi người (toàn bộ cây).
            bucketTotal[0]++;
            bucketRoles.get(0).merge(roleName, 1L, Long::sum);
            // Breakdown vào đơn vị con nếu người này thuộc cây của một đơn vị con.
            UUID unitId = uro.getOrgUnit() != null ? uro.getOrgUnit().getId() : null;
            Integer ci = unitId != null ? unitToChild.get(unitId) : null;
            if (ci != null) {
                bucketTotal[ci + 1]++;
                bucketRoles.get(ci + 1).merge(roleName, 1L, Long::sum);
            }
        }
        // Tên bucket: current đứng đầu (có hậu tố "(hiện tại)"), sau đó các đơn vị con.
        String[] bucketNames = new String[bucketCount];
        bucketNames[0] = targetUnit.getName() + " (hiện tại)";
        for (int i = 0; i < childCount; i++) bucketNames[i + 1] = childUnits.get(i).getName();

        List<AnalyticsSummaryResponse.OrgDistribution> memberDist = new java.util.ArrayList<>();
        List<AnalyticsSummaryResponse.RoleDistribution> roleDist = new java.util.ArrayList<>();
        for (int i = 0; i < bucketCount; i++) {
            memberDist.add(new AnalyticsSummaryResponse.OrgDistribution(bucketNames[i], bucketTotal[i]));
            roleDist.add(new AnalyticsSummaryResponse.RoleDistribution(bucketNames[i],
                bucketRoles.get(i).entrySet().stream()
                    .map(e -> new AnalyticsSummaryResponse.RoleCount(e.getKey(), e.getValue())).toList()));
        }

        // Data for initial load
        SummarySubData.UnitComparisonData comp = getUnitComparison(targetUnit.getId(), null, null, false, null);
        SummarySubData.RiskData risks = getRisks(targetUnit.getId(), "MONTH");
        SummarySubData.RankingData rankings = getRankings(targetUnit.getId(), rankingUnitId, null, null, false);

        return AnalyticsSummaryResponse.builder()
                .orgUnitId(targetUnit.getId()).orgUnitName(targetUnit.getName()).levelName(targetUnit.getOrgHierarchyLevel().getUnitTypeName())
                .kpiCompletionRate(kpiCompletionRate)
                .avgPerformanceScore(evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds) != null ? evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds) : 0)
                .overdueKpiRate(allKpis.isEmpty() ? 0 : (pendingSubs * 10.0 / allKpis.size()))
                .totalMembers((long) allMembers.size()).activeKpis((long) allKpis.size())
                .trendData(getTrend(targetUnit.getId(), "5_MONTHS"))
                .topPerformingUnits(comp.getTopPerformingUnits())
                .worstPerformingUnits(comp.getWorstPerformingUnits())
                .unitKpiData(comp.getUnitKpiData())
                .memberDistribution(memberDist)
                .roleDistribution(roleDist)
                .unitRisks(risks.getUnitRisks())
                .userRisks(risks.getUserRisks())
                .rankings(rankings.getRankings())
                .kpiRankings(rankings.getKpiRankings())
                .rankingOptions(rankings.getRankingOptions())
                .build();
    }

    @Transactional(readOnly = true)
    public List<AnalyticsSummaryResponse.TrendPoint> getTrend(UUID orgUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        List<UUID> subtreeIds = getSubtreeIds(targetUnit);
        List<AnalyticsSummaryResponse.TrendPoint> trends = new ArrayList<>();
        
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);

        // If period is a number, treat as "Last N periods"
        int count = 6;
        if (period != null && period.startsWith("LAST_")) {
            try { count = Integer.parseInt(period.substring(5)); } catch (Exception e) {}
        }

        // Get the last N KPI periods
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        List<KpiPeriod> periods = new ArrayList<>(kpiPeriodRepository.findAllByOrganizationIdOrderByStartDateDesc(orgId, Pageable.ofSize(count)).getContent());
        Collections.reverse(periods);

        for (KpiPeriod p : periods) {
            double sumPct = 0;
            int cnt = 0;
            for (KpiCriteria k : kpis) {
                sumPct += kpiUnitPercent(k, subtreeIds, p.getStartDate(), p.getEndDate());
                cnt++;
            }
            double performance = cnt > 0 ? Math.round(sumPct / cnt) : 0;
            trends.add(new AnalyticsSummaryResponse.TrendPoint(p.getName(), performance, performance * 0.95));
        }
        return trends;
    }

    private static class TimeRange {
        Instant start;
        Instant end;
        TimeRange(Instant s, Instant e) { this.start = s; this.end = e; }
    }

    private TimeRange getTimeRange(String period) {
        if ("ALL".equals(period)) return new TimeRange(null, Instant.now().plus(365, ChronoUnit.DAYS));
        
        try {
            UUID periodId = UUID.fromString(period);
            return kpiPeriodRepository.findById(periodId)
                .map(p -> new TimeRange(p.getStartDate(), p.getEndDate()))
                .orElseGet(() -> {
                    Instant s = getStartInstant(period);
                    return new TimeRange(s, Instant.now().plus(365, ChronoUnit.DAYS));
                });
        } catch (IllegalArgumentException e) {
            Instant s = getStartInstant(period);
            return new TimeRange(s, Instant.now().plus(365, ChronoUnit.DAYS));
        }
    }

    @Transactional(readOnly = true)
    public SummarySubData.UnitComparisonData getUnitComparison(UUID orgUnitId, Instant from, Instant to, Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        UUID orgId = targetUnit.getOrgHierarchyLevel().getOrganization().getId();
        // TẤT CẢ đơn vị con cháu (toàn bộ cây) — không chỉ con trực tiếp.
        List<OrgUnit> descendantUnits = orgUnitRepository.findSubtree(targetUnit.getPath(), orgId).stream()
                .filter(u -> !u.getId().equals(targetUnit.getId()))
                .toList();
        TimeRange range = new TimeRange(from, to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS));

        // Đơn vị hiện tại của user: tiến độ = KPI trực tiếp; hiệu suất = đánh giá.
        List<UUID> currentUnitOnly = List.of(targetUnit.getId());
        List<KpiCriteria> currentKpis = filterByPeriod(
                kpiCriteriaRepository.findByOrgUnitIdInAndStatus(currentUnitOnly, KpiStatus.APPROVED), periodIds);
        double currentSumPct = 0;
        int currentCnt = 0;
        for (KpiCriteria k : currentKpis) {
            currentSumPct += kpiUnitPercent(k, currentUnitOnly, range.start, range.end);
            currentCnt++;
        }
        double currentCompletion = currentCnt > 0 ? Math.round(currentSumPct / currentCnt) : 0;
        int[] currentLM = lateMissedTotal(currentKpis, range);
        AnalyticsSummaryResponse.UnitComparison currentComp = AnalyticsSummaryResponse.UnitComparison.builder()
            .unitName(targetUnit.getName() + " (hiện tại)")
            .performance(unitEvaluationPerformance(targetUnit, periodIds))
            .completionRate(currentCompletion)
            .lateCount(currentLM[0]).missedCount(currentLM[1]).totalExpected(currentLM[2])
            .build();

        List<AnalyticsSummaryResponse.UnitComparison> childComps = descendantUnits.stream().map(unit -> {
            List<UUID> unitSubtree = getSubtreeIds(unit);
            List<KpiCriteria> kpis = filterByPeriod(
                    kpiCriteriaRepository.findByOrgUnitIdInAndStatus(unitSubtree, KpiStatus.APPROVED), periodIds);
            double sumPct = 0;
            int cnt = 0;
            for (KpiCriteria k : kpis) {
                sumPct += kpiUnitPercent(k, unitSubtree, range.start, range.end);
                cnt++;
            }
            double completion = cnt > 0 ? Math.round(sumPct / cnt) : 0;
            int[] lm = lateMissedTotal(kpis, range);
            // performance = hiệu suất ĐÁNH GIÁ; completionRate = tiến độ KPI.
            return AnalyticsSummaryResponse.UnitComparison.builder()
                .unitName(unit.getName())
                .performance(unitEvaluationPerformance(unit, periodIds))
                .completionRate(completion)
                .lateCount(lm[0]).missedCount(lm[1]).totalExpected(lm[2])
                .build();
        }).toList();

        // Gộp: đơn vị hiện tại + tất cả con cháu, sắp theo HIỆU SUẤT.
        List<AnalyticsSummaryResponse.UnitComparison> allComps = new ArrayList<>();
        allComps.add(currentComp);
        allComps.addAll(childComps);
        List<AnalyticsSummaryResponse.UnitComparison> sortedDesc = allComps.stream()
            .sorted((a, b) -> Double.compare(b.getPerformance(), a.getPerformance())).toList();

        // KPI count data: current unit + children
        List<AnalyticsSummaryResponse.UnitKpiComparison> kpiCountData = new ArrayList<>();
        kpiCountData.add(new AnalyticsSummaryResponse.UnitKpiComparison(
            targetUnit.getName() + " (hiện tại)",
            kpiCriteriaRepository.countByOrgUnitIdInAndStatus(currentUnitOnly, KpiStatus.APPROVED),
            submissionRepository.countByOrgUnitIdInAndStatus(currentUnitOnly, SubmissionStatus.APPROVED)));
        descendantUnits.forEach(u -> {
            List<UUID> s = getSubtreeIds(u);
            kpiCountData.add(new AnalyticsSummaryResponse.UnitKpiComparison(u.getName(),
                kpiCriteriaRepository.countByOrgUnitIdInAndStatus(s, KpiStatus.APPROVED),
                submissionRepository.countByOrgUnitIdInAndStatus(s, SubmissionStatus.APPROVED)));
        });

        // Trả TẤT CẢ đơn vị (FE tự cắt Top-N): tốt nhất (hiệu suất giảm dần) + trì trệ (tăng dần).
        return new SummarySubData.UnitComparisonData(
            sortedDesc,
            allComps.stream().sorted(Comparator.comparingDouble(AnalyticsSummaryResponse.UnitComparison::getPerformance)).toList(),
            kpiCountData
        );
    }

    /**
     * Đếm trễ hạn / không nộp theo từng lượt giao (KPI × người được giao).
     * - Trễ hạn: bản nộp SỚM NHẤT của người đó có createdAt > deadline KPI và <= endDate kỳ.
     * - Không nộp: người đó chưa có bản nộp nào và hiện tại đã vượt endDate kỳ.
     * Trả về {late, missed, total}. Không lọc theo trạng thái duyệt (chỉ xét thời điểm nộp).
     */
    private int[] lateMissedTotal(List<KpiCriteria> kpis, TimeRange range) {
        Instant now = Instant.now();
        int late = 0, missed = 0, total = 0;
        for (KpiCriteria kpi : kpis) {
            List<User> assignees = kpi.getAssignees();
            if (assignees == null || assignees.isEmpty()) continue;
            Instant deadline = kpi.getDeadline();
            Instant periodEnd;
            try {
                periodEnd = kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getEndDate() : null;
            } catch (jakarta.persistence.EntityNotFoundException e) {
                periodEnd = null; // kỳ đã bị soft-delete
            }
            List<KpiSubmission> subs = kpi.getSubmissions();
            for (User a : assignees) {
                total++;
                Instant firstAt = null; // thời gian nộp sớm nhất của người này (trong cửa sổ [from,to])
                if (subs != null) {
                    for (KpiSubmission s : subs) {
                        if (s.getSubmittedBy() == null || !s.getSubmittedBy().getId().equals(a.getId())) continue;
                        Instant ts = s.getCreatedAt();
                        if (ts == null) continue;
                        if (range.start != null && ts.isBefore(range.start)) continue;
                        if (range.end != null && ts.isAfter(range.end)) continue;
                        if (firstAt == null || ts.isBefore(firstAt)) firstAt = ts;
                    }
                }
                if (firstAt == null) {
                    if (periodEnd != null && now.isAfter(periodEnd)) missed++;
                } else if (deadline != null && firstAt.isAfter(deadline)
                        && (periodEnd == null || !firstAt.isAfter(periodEnd))) {
                    late++;
                }
            }
        }
        return new int[]{late, missed, total};
    }

    @Transactional(readOnly = true)
    public SummarySubData.RiskData getRisks(UUID orgUnitId, String period) {
        SummarySubData.UnitComparisonData comp = getUnitComparison(orgUnitId, null, null, false, null);
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        List<UUID> subtree = getSubtreeIds(targetUnit);
        TimeRange range = getTimeRange(period);

        List<AnalyticsSummaryResponse.RiskInfo> unitRisks = comp.getWorstPerformingUnits().stream()
            .filter(u -> u.getPerformance() < 60)
            .map(u -> new AnalyticsSummaryResponse.RiskInfo(u.getUnitName(), "UNIT", u.getPerformance(), 0, "HIGH"))
            .toList();

        List<UserRoleOrgUnit> allMembersRaw = userRoleOrgUnitRepository.findByOrgUnitIdIn(subtree);
        Map<UUID, UserRoleOrgUnit> memberMap = new HashMap<>();
        for (UserRoleOrgUnit m : allMembersRaw) {
            UUID userId = m.getUser().getId();
            UserRoleOrgUnit existing = memberMap.get(userId);
            if (existing == null || m.getOrgUnit().getOrgHierarchyLevel().getLevelOrder() > 
                                   existing.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()) {
                memberMap.put(userId, m);
            }
        }

        List<AnalyticsSummaryResponse.RiskInfo> userRisks = memberMap.values().stream().map(m -> {
            User u = m.getUser();
            List<KpiCriteria> userKpis = kpiCriteriaRepository.findApprovedByAssigneeId(u.getId());
            double sumPct = 0;
            int cnt = 0;
            for (KpiCriteria k : userKpis) {
                if (k.getTargetValue() != null && k.getTargetValue() > 0) {
                    sumPct += kpiUserPercent(k, u.getId(), range.start, range.end);
                    cnt++;
                }
            }
            double perf = cnt > 0 ? Math.round(sumPct / cnt) : 0;
            return new AnalyticsSummaryResponse.RiskInfo(u.getFullName(), "USER", perf, 0, perf < 50 ? "HIGH" : perf < 75 ? "MEDIUM" : "LOW");
        })
        .filter(r -> r.getPerformance() < 75)
        .sorted(Comparator.comparingDouble(AnalyticsSummaryResponse.RiskInfo::getPerformance))
        .limit(10)
        .toList();

        return new SummarySubData.RiskData(unitRisks, userRisks);
    }

    @Transactional(readOnly = true)
    /** Overload giữ hành vi cũ (không phân trang): dùng cho bootstrap getSummary. */
    public SummarySubData.RankingData getRankings(UUID orgUnitId, UUID rankingUnitId, Instant from, Instant to, Boolean onlyApproved) {
        return getRankings(orgUnitId, rankingUnitId, from, to, onlyApproved, null, 0, 50, "performance", "DESC");
    }

    public SummarySubData.RankingData getRankings(UUID orgUnitId, UUID rankingUnitId, Instant from, Instant to,
                                                  Boolean onlyApproved, java.util.Collection<UUID> periodIds,
                                                  int page, int size, String sortBy, String sortDir) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        OrgUnit rankUnit = rankingUnitId != null ? orgUnitRepository.findById(rankingUnitId).orElse(targetUnit) : targetUnit;
        List<UUID> subtree = getSubtreeIds(rankUnit);
        TimeRange range = new TimeRange(from, to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS));

        List<UserRoleOrgUnit> allAssignments = userRoleOrgUnitRepository.findByOrgUnitIdIn(subtree);
        Map<UUID, UserRoleOrgUnit> memberMap = new HashMap<>();
        for (UserRoleOrgUnit m : allAssignments) {
            UUID userId = m.getUser().getId();
            UserRoleOrgUnit existing = memberMap.get(userId);
            if (existing == null || m.getOrgUnit().getOrgHierarchyLevel().getLevelOrder() >
                                   existing.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()) {
                memberMap.put(userId, m);
            }
        }

        List<AnalyticsSummaryResponse.RankingItem> items = memberMap.values().stream()
            .map(m -> {
                User u = m.getUser();
                List<KpiCriteria> userKpis = kpiCriteriaRepository.findApprovedByAssigneeId(u.getId());
                // Tiến độ trung bình = TB % đạt mục tiêu của các KPI (actual/target).
                double sumPct = 0;
                int kpiCount = 0;
                for (KpiCriteria k : userKpis) {
                    if (k.getTargetValue() != null && k.getTargetValue() > 0) {
                        sumPct += kpiUserPercent(k, u.getId(), range.start, range.end);
                        kpiCount++;
                    }
                }
                double avgProgress = kpiCount > 0 ? Math.round(sumPct / kpiCount * 100.0) / 100.0 : 0;

                // Hiệu suất = hiệu suất ĐÁNH GIÁ (per-user), giống unitEvaluationPerformance cho đơn vị:
                // theo đợt đang chọn nếu có, ngược lại gộp mọi đợt KPI của user.
                java.util.Set<UUID> evalPeriodIds = (periodIds != null && !periodIds.isEmpty())
                    ? new java.util.LinkedHashSet<>(periodIds)
                    : userKpis.stream().map(KpiCriteria::getKpiPeriod).filter(java.util.Objects::nonNull)
                        .map(KpiPeriod::getId).collect(java.util.stream.Collectors.toSet());
                Double evalPerf = evalPeriodIds.isEmpty()
                    ? null
                    : evaluationService.averagePerformance(java.util.Set.of(u.getId()), evalPeriodIds);
                // Giữ 1 chữ số thập phân: thang "điểm" (matrix, 1..5) cần chính xác.
                double performance = evalPerf != null ? Math.round(evalPerf * 10.0) / 10.0 : 0;

                long completed = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
                Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

                return AnalyticsSummaryResponse.RankingItem.builder()
                    .name(u.getFullName())
                    .avatar(u.getAvatarUrl())
                    .score(avgScore != null ? avgScore : 0)
                    .performance(performance)
                    .avgProgress(avgProgress)
                    .kpiCount(completed)
                    .subText(m.getOrgUnit().getName())
                    .build();
            }).toList();

        // Build hierarchical ranking options using the full subtree of targetUnit
        User currentUser = getCurrentUser();
        Set<UUID> currentUserUnitIds = userRoleOrgUnitRepository.findByUserId(currentUser.getId())
            .stream().map(a -> a.getOrgUnit().getId()).collect(Collectors.toSet());
        UUID orgId = targetUnit.getOrgHierarchyLevel().getOrganization().getId();
        List<OrgUnit> optSubtree = orgUnitRepository.findSubtree(targetUnit.getPath(), orgId);
        List<OrgUnit> sortedOpts = optSubtree.stream()
            .sorted(Comparator.comparing(OrgUnit::getPath))
            .toList();
        int minSlashes = sortedOpts.isEmpty() ? 0 : sortedOpts.stream()
            .mapToInt(u -> (int) u.getPath().chars().filter(c -> c == '/').count())
            .min().orElse(0);
        List<AnalyticsSummaryResponse.RankingOption> opts = sortedOpts.stream().map(u -> {
            int depth = (int) u.getPath().chars().filter(c -> c == '/').count() - minSlashes;
            String displayName = currentUserUnitIds.contains(u.getId()) ? u.getName() + " (hiện tại)" : u.getName();
            return AnalyticsSummaryResponse.RankingOption.builder()
                .id(u.getId()).name(displayName).depth(depth).build();
        }).collect(Collectors.toList());

        // Sort server-side theo trường + hướng (mặc định hiệu suất giảm dần), rồi cắt trang.
        Comparator<AnalyticsSummaryResponse.RankingItem> cmp =
            "avgProgress".equals(sortBy)
                ? Comparator.comparingDouble(AnalyticsSummaryResponse.RankingItem::getAvgProgress)
                : Comparator.comparingDouble(AnalyticsSummaryResponse.RankingItem::getPerformance);
        if (!"ASC".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        List<AnalyticsSummaryResponse.RankingItem> sorted = items.stream().sorted(cmp).toList();

        int pageSize = size > 0 ? size : 5;
        int pageIdx = Math.max(page, 0);
        long totalElements = sorted.size();
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        int fromIdx = Math.min(pageIdx * pageSize, sorted.size());
        int toIdx = Math.min(fromIdx + pageSize, sorted.size());
        List<AnalyticsSummaryResponse.RankingItem> pageItems = sorted.subList(fromIdx, toIdx);

        return new SummarySubData.RankingData(
            pageItems,
            items.stream().sorted((a,b) -> Long.compare(b.getKpiCount(), a.getKpiCount())).limit(10).toList(),
            opts,
            totalElements,
            totalPages
        );
    }

    private OrgUnit getTargetUnit(UUID orgUnitId) {
        User u = getCurrentUser();
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
        if (roles.isEmpty()) return null;
        OrgUnit userUnit = roles.get(0).getOrgUnit();
        OrgUnit target = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        return target.getPath().startsWith(userUnit.getPath()) ? target : userUnit;
    }

    private Instant getStartInstant(String period) {
        if ("ALL".equals(period)) return null;
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        switch (period) {
            case "TODAY": return now.truncatedTo(java.time.temporal.ChronoUnit.DAYS).toInstant();
            case "WEEK": return now.minusWeeks(1).toInstant();
            case "QUARTER": return now.minusMonths(3).toInstant();
            case "HALF_YEAR": return now.minusMonths(6).toInstant();
            case "YEAR": return now.minusYears(1).toInstant();
            default: return now.minusMonths(1).toInstant();
        }
    }

    @Transactional(readOnly = true)
    public List<ExportDetailedPerformanceResponse> getDetailedExportStats(UUID orgUnitId, UUID kpiPeriodId) {
        User currentUser = getCurrentUser();
        OrgUnit targetUnit = orgUnitId != null ? orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", orgUnitId)) : null;
        
        if (targetUnit == null) {
            List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (userRoles.isEmpty()) return Collections.emptyList();
            targetUnit = userRoles.get(0).getOrgUnit();
        }

        List<UUID> subtreeIds = getSubtreeIds(targetUnit);
        List<UserRoleOrgUnit> allAssignments = userRoleOrgUnitRepository.findByOrgUnitIdIn(subtreeIds);
        
        // Use a map to keep only the "best" assignment per user (highest unit or lowest rank)
        Map<UUID, UserRoleOrgUnit> memberMap = new HashMap<>();
        for (UserRoleOrgUnit m : allAssignments) {
            UUID userId = m.getUser().getId();
            UserRoleOrgUnit existing = memberMap.get(userId);
            if (existing == null || m.getOrgUnit().getOrgHierarchyLevel().getLevelOrder() > 
                                   existing.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()) {
                memberMap.put(userId, m);
            }
        }

        List<ExportDetailedPerformanceResponse> result = new ArrayList<>();
        for (UserRoleOrgUnit assignment : memberMap.values()) {
            User user = assignment.getUser();
            
            // 1. Fetch KPIs for this user and period
            List<KpiCriteria> userKpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                    user.getId(), kpiPeriodId, List.of(KpiStatus.APPROVED, KpiStatus.EDITED), Pageable.unpaged()).getContent();
            
            // Skip users with no KPIs for this period (e.g., Directors or managers who only evaluate)
            if (userKpis.isEmpty()) continue;

            List<KpiDetailRow> kpiDetails = new ArrayList<>();
            for (KpiCriteria kpi : userKpis) {
                // Get approved submissions for this user and KPI
                List<KpiSubmission> submissions = submissionRepository.findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), user.getId());
                
                boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
                List<KpiSubmission> approvedSubs = submissions.stream()
                        .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                        .toList();
                double actual = reverse ? KpiMetricsCalculator.latest(approvedSubs) : KpiMetricsCalculator.sum(approvedSubs);
                
                Double managerScore = submissions.stream()
                        .filter(s -> s.getStatus() == SubmissionStatus.APPROVED && s.getManagerScore() != null)
                        .mapToDouble(KpiSubmission::getManagerScore)
                        .findFirst() // Usually there's one final approved submission for the period
                        .stream().boxed().findFirst().orElse(null);

                String objectiveName = null;
                String keyResultName = null;
                if (kpi.getKeyResult() != null) {
                    keyResultName = kpi.getKeyResult().getName();
                    if (kpi.getKeyResult().getObjective() != null) {
                        objectiveName = kpi.getKeyResult().getObjective().getName();
                    }
                }

                kpiDetails.add(KpiDetailRow.builder()
                        .kpiName(kpi.getName())
                        .weight(kpi.getWeight())
                        .unit(kpi.getUnit())
                        .targetValue(kpi.getTargetValue())
                        .actualValue(actual)
                        .completionRate(reverse ? KpiMetricsCalculator.reversePercent(approvedSubs, kpi.getTargetValue() != null ? kpi.getTargetValue() : 0)
                                : (kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? (actual / kpi.getTargetValue()) * 100 : 0))
                        .managerScore(managerScore)
                        .objectiveName(objectiveName)
                        .keyResultName(keyResultName)
                        .build());
            }
            
            // 2. Fetch all evaluations for this user in this period
            List<Evaluation> evaluations = evaluationRepository.findByUserIdAndKpiPeriodId(user.getId(), kpiPeriodId);
            
            ExportDetailedPerformanceResponse row = ExportDetailedPerformanceResponse.builder()
                    .userId(user.getId())
                    .employeeCode(user.getEmployeeCode())
                    .fullName(user.getFullName())
                    .email(user.getEmail())
                    .role(assignment.getRole() != null ? assignment.getRole().getName() : "N/A")
                    .orgUnitName(assignment.getOrgUnit().getName())
                    .kpis(kpiDetails)
                    .build();
            
            // 3. Map evaluations to Role Levels
            for (Evaluation eval : evaluations) {
                User evaluator = eval.getEvaluator();
                // We check evaluator's role level. Note: A user might have roles in multiple units.
                // We try to find the level relative to the target org unit or the evaluated user's unit.
                int level = permissionChecker.getMinLevelInOrgUnit(evaluator.getId(), assignment.getOrgUnit().getId());
                
                if (level >= 4) { // Team Leader Level or lower (Staff self-eval not included as it's separate in some systems, but here Evaluation usually means manager eval)
                    row.setTeamLeaderScore(eval.getScore());
                } else if (level == 3) { // Dept Head Level
                    row.setDeptHeadScore(eval.getScore());
                } else if (level <= 2) { // Director Level and above
                    row.setDirectorScore(eval.getScore());
                }
            }
            
            result.add(row);
        }
        
        return result;
    }
}
