package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.stats.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

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

        long pendingSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(unitIds, SubmissionStatus.PENDING);
        long approvedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(unitIds, SubmissionStatus.APPROVED);
        long rejectedSub = submissionRepository.countBySubmittedByUserOrgUnitInAndStatus(unitIds, SubmissionStatus.REJECTED);

        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.PENDING_APPROVAL);

        return OverviewStatsResponse.builder()
                .totalUsers(totalPersonnelCount)
                .totalOrgUnits((int) kpiCriteriaRepository.countDistinctOrgUnitsOfAssigneesIn(unitIds, activeStatuses))
                .totalKpiCriteria(kpiCriteriaRepository.countTotalKpiCriteriaIn(unitIds, activeStatuses))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.REJECTED))
                .draftKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(unitIds, KpiStatus.DRAFT))
                .totalSubmissions((int) (pendingSub + approvedSub + rejectedSub))
                .approvedSubmissions((int) approvedSub)
                .pendingSubmissions((int) pendingSub)
                .rejectedSubmissions((int) rejectedSub)
                .totalEvaluations(evaluationRepository.countByOrgUnitIdIn(unitIds))
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        User currentUser = getCurrentUser();
        // Get all units that the user has dashboard view access to, including their subtrees
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "DASHBOARD:VIEW");
        List<OrgUnit> authorizedUnits = orgUnitRepository.findAllInSubtrees(rootIds);

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
                 // Find the MOST SPECIFIC (deepest) assignment I have for this context
                 UserRoleOrgUnit myPrimary = currentUserAssignments.stream()
                         .filter(a -> u.getId().equals(currentUser.getId()) || primary.getOrgUnit().getPath().startsWith(a.getOrgUnit().getPath()))
                         .sorted((a, b) -> Integer.compare(b.getOrgUnit().getOrgHierarchyLevel().getLevelOrder(), 
                                                        a.getOrgUnit().getOrgHierarchyLevel().getLevelOrder()))
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

            if (status.equals("NOT_STARTED") || status.equals("OVERDUE") || status.equals("REJECTED") || status.equals("EDIT")) {
                pendingTaskCount++;
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
                    .startDate(criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getStartDate() : null)
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
                .pendingTaskCount(pendingTaskCount)
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
            double actualValue = submissionRepository.sumActualValueByUserIdAndKpiIdInPeriod(
                userId, k.getId(), 
                from != null ? from : Instant.EPOCH, 
                to != null ? to : Instant.now().plus(365, ChronoUnit.DAYS)
            );

            double completionRate = 0;
            if (k.getTargetValue() != null && k.getTargetValue() > 0) {
                completionRate = Math.round((actualValue / k.getTargetValue()) * 100);
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

        List<AnalyticsMyStatsResponse.EvaluationItem> evalItems = evaluations.stream().map(e ->
            AnalyticsMyStatsResponse.EvaluationItem.builder()
                    .id(e.getId())
                    .kpiName(e.getKpiPeriod().getName())
                    .score(e.getScore())
                    .comment(e.getComment())
                    .evaluatorName(e.getEvaluator().getFullName())
                    .createdAt(e.getCreatedAt())
                    .build()
        ).toList();

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
    public AnalyticsDrillDownResponse getDrillDown(UUID orgUnitId) {
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
                double actual = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
                double target = kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? kpi.getTargetValue() : 1.0;
                totalPerformance += Math.round((actual / target) * 100.0);
            }
            return AnalyticsDrillDownResponse.OrgUnitSummary.builder()
                    .orgUnitId(unit.getId())
                    .orgUnitName(unit.getName())
                    .levelName(unit.getOrgHierarchyLevel().getUnitTypeName())
                    .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                    .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedKpi(unitKpis.size())
                    .completionRate(!unitKpis.isEmpty() ? totalPerformance / unitKpis.size() : 0)
                    .totalSubmissions(submissionRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds))
                    .hasChildren(!orgUnitRepository.findByParentId(unit.getId()).isEmpty())
                    .build();
        }).toList();

        List<AnalyticsDrillDownResponse.HeatmapPoint> heatmapData = new ArrayList<>();
        for (OrgUnit child : childUnits) {
            List<UUID> subtreeIds = getSubtreeIds(child);
            List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
            for (KpiCriteria kpi : kpis) {
                double actual = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
                double target = kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? kpi.getTargetValue() : 1.0;
                heatmapData.add(AnalyticsDrillDownResponse.HeatmapPoint.builder().x(child.getName()).y(kpi.getName()).value(Math.round((actual / target) * 100.0)).build());
            }
        }

        List<UserRoleOrgUnit> members = userRoleOrgUnitRepository.findByOrgUnitId(currentOrgUnit.getId());
        List<AnalyticsDrillDownResponse.EmployeeSummary> employeeSummaries = members.stream().map(m -> {
            User u = m.getUser();
            return AnalyticsDrillDownResponse.EmployeeSummary.builder()
                    .userId(u.getId()).fullName(u.getFullName()).email(u.getEmail()).roleName(m.getRole().getName())
                    .assignedKpi(kpiCriteriaRepository.countByAssigneeId(u.getId()))
                    .totalSubmissions(submissionRepository.countBySubmittedById(u.getId()))
                    .approvedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByUserId(u.getId())).build();
        }).toList();

        List<UUID> currentSubtree = getSubtreeIds(currentOrgUnit);
        return AnalyticsDrillDownResponse.builder()
                .orgUnitId(currentOrgUnit.getId()).orgUnitName(currentOrgUnit.getName()).levelName(currentOrgUnit.getOrgHierarchyLevel().getUnitTypeName())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(currentSubtree, KpiStatus.APPROVED))
                .totalSubmissions(submissionRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.REJECTED))
                .avgScore(evaluationRepository.avgScoreByOrgUnitIdIn(currentSubtree))
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
            
            double totalActual = 0;
            double totalTarget = 0;
            List<KpiCriteria> userKpis = kpiCriteriaRepository.findApprovedByAssigneeId(u.getId());
            for (KpiCriteria k : userKpis) {
                totalActual += submissionRepository.sumActualValueByUserIdAndKpiIdInPeriod(u.getId(), k.getId(), Instant.EPOCH, Instant.now().plus(365, ChronoUnit.DAYS));
                totalTarget += (k.getTargetValue() != null ? k.getTargetValue() : 0);
            }
            double perfRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100.0) : 0;

            long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
            allRows.add(AnalyticsDetailRow.builder()
                    .userId(u.getId()).fullName(u.getFullName()).email(u.getEmail())
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
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath());
        return subtree.isEmpty() ? List.of(unit.getId()) : subtree.stream().map(OrgUnit::getId).toList();
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
        double totalActual = 0;
        double totalTarget = 0;
        for (KpiCriteria kpi : allKpis) {
            totalActual += submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
            totalTarget += (kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? kpi.getTargetValue() : 0);
        }
        
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

        // Structure logic
        List<AnalyticsSummaryResponse.OrgDistribution> memberDist = childUnits.stream()
            .map(u -> new AnalyticsSummaryResponse.OrgDistribution(u.getName(), (long) getSubtreeIds(u).size()))
            .toList();

        List<AnalyticsSummaryResponse.RoleDistribution> roleDist = childUnits.stream().map(u -> {
            List<UUID> subtree = getSubtreeIds(u);
            List<UserRoleOrgUnit> members = userRoleOrgUnitRepository.findByOrgUnitIdIn(subtree);
            
            long l0 = members.stream().filter(m -> m.getRole().getLevel() != null && m.getRole().getLevel() == 0).count();
            long l1 = members.stream().filter(m -> m.getRole().getLevel() != null && m.getRole().getLevel() == 1).count();
            long l2 = members.stream().filter(m -> m.getRole().getLevel() != null && m.getRole().getLevel() == 2).count();
            long l3 = members.stream().filter(m -> m.getRole().getLevel() != null && m.getRole().getLevel() == 3).count();
            long l4 = members.stream().filter(m -> m.getRole().getLevel() != null && m.getRole().getLevel() == 4).count();
            long other = members.size() - l0 - l1 - l2 - l3 - l4;
            
            return new AnalyticsSummaryResponse.RoleDistribution(u.getName(), l0, l1, l2, l3, l4, other);
        }).toList();

        // Data for initial load
        SummarySubData.UnitComparisonData comp = getUnitComparison(targetUnit.getId(), "MONTH");
        SummarySubData.RiskData risks = getRisks(targetUnit.getId(), "MONTH");
        SummarySubData.RankingData rankings = getRankings(targetUnit.getId(), rankingUnitId, "MONTH");

        return AnalyticsSummaryResponse.builder()
                .orgUnitId(targetUnit.getId()).orgUnitName(targetUnit.getName()).levelName(targetUnit.getOrgHierarchyLevel().getUnitTypeName())
                .kpiCompletionRate(totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100.0) : 0)
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
        List<KpiPeriod> periods = kpiPeriodRepository.findAllByOrganizationIdOrderByStartDateDesc(orgId, Pageable.ofSize(count)).getContent();
        Collections.reverse(periods);

        for (KpiPeriod p : periods) {
            double periodActual = 0;
            double periodTarget = 0;
            
            for (KpiCriteria k : kpis) {
                periodActual += submissionRepository.sumActualValueByOrgUnitIdsAndKpiIdInPeriod(subtreeIds, k.getId(), p.getStartDate(), p.getEndDate());
                periodTarget += (k.getTargetValue() != null ? k.getTargetValue() : 0);
            }
            
            double performance = periodTarget > 0 ? Math.round((periodActual / periodTarget) * 100.0) : 0;
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
    public SummarySubData.UnitComparisonData getUnitComparison(UUID orgUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(targetUnit.getId());
        TimeRange range = getTimeRange(period);

        List<AnalyticsSummaryResponse.UnitComparison> unitComps = childUnits.stream().map(unit -> {
            List<UUID> unitSubtree = getSubtreeIds(unit);
            List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(unitSubtree, KpiStatus.APPROVED);
            double totalAct = 0;
            double totalTar = 0;
            for (KpiCriteria k : kpis) {
                totalAct += submissionRepository.sumActualValueByOrgUnitIdsAndKpiIdInPeriod(unitSubtree, k.getId(), range.start != null ? range.start : Instant.EPOCH, range.end);
                totalTar += (k.getTargetValue() != null ? k.getTargetValue() : 0);
            }
            double performance = totalTar > 0 ? Math.round((totalAct / totalTar) * 100.0) : 0;
            return new AnalyticsSummaryResponse.UnitComparison(unit.getName(), performance, performance);
        }).sorted((a,b) -> Double.compare(b.getPerformance(), a.getPerformance())).toList();

        return new SummarySubData.UnitComparisonData(
            unitComps.stream().limit(5).toList(), 
            unitComps.stream().sorted(Comparator.comparingDouble(AnalyticsSummaryResponse.UnitComparison::getPerformance)).limit(5).toList(), 
            childUnits.stream().map(u -> {
                List<UUID> s = getSubtreeIds(u);
                return new AnalyticsSummaryResponse.UnitKpiComparison(u.getName(), kpiCriteriaRepository.countByOrgUnitIdInAndStatus(s, KpiStatus.APPROVED), submissionRepository.countByOrgUnitIdInAndStatus(s, SubmissionStatus.APPROVED));
            }).toList()
        );
    }

    @Transactional(readOnly = true)
    public SummarySubData.RiskData getRisks(UUID orgUnitId, String period) {
        SummarySubData.UnitComparisonData comp = getUnitComparison(orgUnitId, period);
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
            double totalAct = 0;
            double totalTar = 0;
            for (KpiCriteria k : userKpis) {
                totalAct += submissionRepository.sumActualValueByUserIdAndKpiIdInPeriod(u.getId(), k.getId(), range.start != null ? range.start : Instant.EPOCH, range.end);
                totalTar += (k.getTargetValue() != null ? k.getTargetValue() : 0);
            }
            double perf = totalTar > 0 ? Math.round((totalAct / totalTar) * 100.0) : 0;
            return new AnalyticsSummaryResponse.RiskInfo(u.getFullName(), "USER", perf, 0, perf < 50 ? "HIGH" : perf < 75 ? "MEDIUM" : "LOW");
        })
        .filter(r -> r.getPerformance() < 75)
        .sorted(Comparator.comparingDouble(AnalyticsSummaryResponse.RiskInfo::getPerformance))
        .limit(10)
        .toList();

        return new SummarySubData.RiskData(unitRisks, userRisks);
    }

    @Transactional(readOnly = true)
    public SummarySubData.RankingData getRankings(UUID orgUnitId, UUID rankingUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        OrgUnit rankUnit = rankingUnitId != null ? orgUnitRepository.findById(rankingUnitId).orElse(targetUnit) : targetUnit;
        List<UUID> subtree = getSubtreeIds(rankUnit);
        TimeRange range = getTimeRange(period);

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
                double totalAct = 0;
                double totalTar = 0;
                for (KpiCriteria k : userKpis) {
                    totalAct += submissionRepository.sumActualValueByUserIdAndKpiIdInPeriod(u.getId(), k.getId(), range.start != null ? range.start : Instant.EPOCH, range.end);
                    totalTar += (k.getTargetValue() != null ? k.getTargetValue() : 0);
                }
                double performance = totalTar > 0 ? Math.round((totalAct / totalTar) * 100.0) : 0;
                long completed = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
                Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());
                
                return new AnalyticsSummaryResponse.RankingItem(
                    u.getFullName(), null, 
                    avgScore != null ? avgScore : 0, 
                    performance, 
                    completed,
                    m.getOrgUnit().getName()
                );
            }).toList();

        List<AnalyticsSummaryResponse.RankingOption> opts = new ArrayList<>();
        opts.add(new AnalyticsSummaryResponse.RankingOption(targetUnit.getId(), "Tổng (" + targetUnit.getName() + ")"));
        orgUnitRepository.findByParentId(targetUnit.getId()).forEach(u -> opts.add(new AnalyticsSummaryResponse.RankingOption(u.getId(), u.getName())));
        
        return new SummarySubData.RankingData(
            items.stream().sorted((a,b) -> Double.compare(b.getPerformance(), a.getPerformance())).limit(50).toList(), 
            items.stream().sorted((a,b) -> Long.compare(b.getKpiCount(), a.getKpiCount())).limit(10).toList(), 
            opts
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
}
