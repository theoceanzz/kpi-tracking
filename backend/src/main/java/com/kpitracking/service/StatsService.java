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

    @Transactional(readOnly = true)
    public OverviewStatsResponse getOverviewStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) {
            return OverviewStatsResponse.builder().build();
        }

        List<UserRoleOrgUnit> currentUserRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        boolean isDirector = currentUserRoles.stream().anyMatch(r -> r.getRole().getName().equals("DIRECTOR"));

        if (isDirector) {
            return OverviewStatsResponse.builder()
                    .totalUsers(userRoleOrgUnitRepository.countUsersByOrganizationId(orgId))
                    .totalOrgUnits(orgUnitRepository.countByOrgHierarchyLevel_Organization_Id(orgId))
                    .totalKpiCriteria(kpiCriteriaRepository.countByOrganizationId(orgId))
                    .approvedKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.APPROVED))
                    .pendingKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.PENDING_APPROVAL))
                    .rejectedKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.REJECTED))
                    .draftKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.DRAFT))
                    .totalSubmissions(submissionRepository.countByOrganizationId(orgId))
                    .pendingSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.PENDING))
                    .approvedSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.APPROVED))
                    .rejectedSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.REJECTED))
                    .totalEvaluations(evaluationRepository.countByOrganizationId(orgId))
                    .build();
        } else {
            // For HEAD or other roles, filter by department
            if (currentUserRoles.isEmpty()) return OverviewStatsResponse.builder().build();
            OrgUnit dept = currentUserRoles.get(0).getOrgUnit();
            String path = dept.getPath() + "%";

            return OverviewStatsResponse.builder()
                    .totalUsers(userRoleOrgUnitRepository.findUsersByOrgUnitPath(path).size())
                    .totalOrgUnits(orgUnitRepository.findSubtree(dept.getPath()).size())
                    .totalKpiCriteria(kpiCriteriaRepository.countByOrgUnitPath(path))
                    .approvedKpi(kpiCriteriaRepository.countByOrgUnitPathAndStatus(path, KpiStatus.APPROVED))
                    .pendingKpi(kpiCriteriaRepository.countByOrgUnitPathAndStatus(path, KpiStatus.PENDING_APPROVAL))
                    .rejectedKpi(kpiCriteriaRepository.countByOrgUnitPathAndStatus(path, KpiStatus.REJECTED))
                    .draftKpi(kpiCriteriaRepository.countByOrgUnitPathAndStatus(path, KpiStatus.DRAFT))
                    .totalSubmissions(submissionRepository.countByOrgUnitPath(path))
                    .pendingSubmissions(submissionRepository.countByOrgUnitPathAndStatus(path, SubmissionStatus.PENDING))
                    .approvedSubmissions(submissionRepository.countByOrgUnitPathAndStatus(path, SubmissionStatus.APPROVED))
                    .rejectedSubmissions(submissionRepository.countByOrgUnitPathAndStatus(path, SubmissionStatus.REJECTED))
                    .totalEvaluations(evaluationRepository.countByOrgUnitPath(path))
                    .build();
        }
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) return Collections.emptyList();

        // For now, return stats per org unit
        List<OrgUnit> orgUnits = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);

        return orgUnits.stream().map(unit -> OrgUnitKpiStatsResponse.builder()
                .orgUnitId(unit.getId())
                .orgUnitName(unit.getName())
                .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitId(unit.getId()))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.REJECTED))
                .totalSubmissions(submissionRepository.countByOrgUnitId(unit.getId()))
                .approvedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.REJECTED))
                .build()
        ).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<EmployeeKpiStatsResponse> getEmployeeKpiStats(int page, int size) {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) {
            return PageResponse.<EmployeeKpiStatsResponse>builder()
                    .content(Collections.emptyList())
                    .totalElements(0)
                    .totalPages(0)
                    .build();
        }

        List<UserRoleOrgUnit> currentUserRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        boolean isDirector = currentUserRoles.stream().anyMatch(r -> r.getRole().getName().equals("DIRECTOR"));
        
        List<User> allUsers;
        if (isDirector) {
            allUsers = userRoleOrgUnitRepository.findUsersByOrganizationId(orgId);
        } else {
            if (currentUserRoles.isEmpty()) {
                return PageResponse.<EmployeeKpiStatsResponse>builder().content(Collections.emptyList()).build();
            }
            OrgUnit dept = currentUserRoles.get(0).getOrgUnit();
            allUsers = userRoleOrgUnitRepository.findUsersByOrgUnitPath(dept.getPath() + "%");
        }

        List<EmployeeKpiStatsResponse> allStats = new ArrayList<>();

        for (User u : allUsers) {
             List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
             String roleName = roles.isEmpty() ? "N/A" : roles.get(0).getRole().getName();
             String orgUnitName = roles.isEmpty() ? null : roles.get(0).getOrgUnit().getName();

             long assignedKpi = kpiCriteriaRepository.countByAssigneeAndStatus(u.getId(), KpiStatus.APPROVED);
             long totalSub = submissionRepository.countBySubmittedById(u.getId());
             long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
             long pendingSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING);
             long rejectedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED);
             Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

             // Calculate late count
             List<KpiCriteria> employeeCriteria = kpiCriteriaRepository.findByUserIdInAssignees(u.getId(), Pageable.unpaged()).getContent();
             List<KpiSubmission> employeeSubs = submissionRepository.findBySubmittedById(u.getId(), Pageable.unpaged()).getContent();
             long lateCount = 0;
             Instant now = Instant.now();

             for (KpiCriteria criteria : employeeCriteria) {
                 if (criteria.getStatus() != KpiStatus.APPROVED) continue;
                 
                 boolean isApproved = employeeSubs.stream().anyMatch(s -> s.getKpiCriteria().getId().equals(criteria.getId()) && s.getStatus() == SubmissionStatus.APPROVED);
                 boolean isPending = employeeSubs.stream().anyMatch(s -> s.getKpiCriteria().getId().equals(criteria.getId()) && s.getStatus() == SubmissionStatus.PENDING);
                 
                 Instant deadline = criteria.getKpiPeriod() != null ? criteria.getKpiPeriod().getEndDate() : null;
                 if (!isApproved && !isPending && deadline != null && deadline.isBefore(now)) {
                     lateCount++;
                 }
             }

             allStats.add(EmployeeKpiStatsResponse.builder()
                     .userId(u.getId())
                     .fullName(u.getFullName())
                     .email(u.getEmail())
                     .role(roleName)
                     .orgUnitName(orgUnitName)
                     .assignedKpi(assignedKpi)
                     .totalSubmissions(totalSub)
                     .approvedSubmissions(approvedSub)
                     .pendingSubmissions(pendingSub)
                     .rejectedSubmissions(rejectedSub)
                     .lateSubmissions(lateCount)
                     .averageScore(avgScore)
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

        // 1. Basic counts
        long totalAssigned = kpiCriteriaRepository.countByAssigneeAndStatus(userId, KpiStatus.APPROVED);
        long totalSubmissions = submissionRepository.countBySubmittedById(userId);
        long approved = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED);
        long pending = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING);
        long rejected = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED);
        Double avgScore = evaluationRepository.avgScoreByUserId(userId);

        // 2. Fetch detailed tasks
        List<KpiCriteria> assignedCriteria = kpiCriteriaRepository.findByUserIdInAssignees(userId, Pageable.unpaged()).getContent();
        List<KpiSubmission> mySubmissions = submissionRepository.findBySubmittedById(userId, Pageable.unpaged()).getContent();

        List<KpiTaskResponse> allTasks = new ArrayList<>();
        long lateCount = 0;
        Instant now = Instant.now();

        for (KpiCriteria criteria : assignedCriteria) {
            if (criteria.getStatus() != KpiStatus.APPROVED) continue;

            // Find submissions for this criteria
            List<KpiSubmission> criteriaSubs = mySubmissions.stream()
                    .filter(s -> s.getKpiCriteria().getId().equals(criteria.getId()))
                    .toList();

            boolean isApproved = criteriaSubs.stream().anyMatch(s -> s.getStatus() == SubmissionStatus.APPROVED);
            boolean isPending = criteriaSubs.stream().anyMatch(s -> s.getStatus() == SubmissionStatus.PENDING);

            String status = "NOT_STARTED";
            if (isApproved) status = "APPROVED";
            else if (isPending) status = "PENDING";

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

        // 3. Paginate
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
