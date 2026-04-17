package com.kpitracking.service;

import com.kpitracking.dto.response.stats.OrgUnitKpiStatsResponse;
import com.kpitracking.dto.response.stats.EmployeeKpiStatsResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
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

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional(readOnly = true)
    public OverviewStatsResponse getOverviewStats() {
        return OverviewStatsResponse.builder()
                .totalUsers(userRepository.count())
                .totalDepartments(orgUnitRepository.count())
                .totalKpiCriteria(kpiCriteriaRepository.count())
                .approvedKpi(kpiCriteriaRepository.countByStatus(KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByStatus(KpiStatus.PENDING_APPROVAL))
                .totalSubmissions(submissionRepository.count())
                .pendingSubmissions(submissionRepository.countByStatus(SubmissionStatus.PENDING))
                .approvedSubmissions(submissionRepository.countByStatus(SubmissionStatus.APPROVED))
                .rejectedSubmissions(submissionRepository.countByStatus(SubmissionStatus.REJECTED))
                .totalEvaluations(evaluationRepository.count())
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        // For now, return stats per org unit
        List<OrgUnit> orgUnits = orgUnitRepository.findAll();

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
    public List<EmployeeKpiStatsResponse> getEmployeeKpiStats() {
        List<User> users = userRepository.findAll();

        List<EmployeeKpiStatsResponse> result = new ArrayList<>();

        for (User u : users) {
             List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
             String roleName = roles.isEmpty() ? "N/A" : roles.get(0).getRole().getName();
             String orgUnitName = roles.isEmpty() ? null : roles.get(0).getOrgUnit().getName();

             long assignedKpi = kpiCriteriaRepository.countByAssignedToIdAndStatus(u.getId(), KpiStatus.APPROVED);
             long totalSub = submissionRepository.countBySubmittedById(u.getId());
             long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
             long pendingSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING);
             long rejectedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED);
             Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

             result.add(EmployeeKpiStatsResponse.builder()
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
                     .averageScore(avgScore)
                     .build());
        }

        result.sort((a, b) -> Long.compare(b.getApprovedSubmissions(), a.getApprovedSubmissions()));
        return result;
    }

    @Transactional(readOnly = true)
    public MyKpiProgressResponse getMyKpiProgress() {
        User currentUser = getCurrentUser();
        UUID userId = currentUser.getId();

        long totalAssigned = kpiCriteriaRepository.countByAssignedToIdAndStatus(userId, KpiStatus.APPROVED);
        long totalSubmissions = submissionRepository.countBySubmittedById(userId);
        long approved = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED);
        long pending = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING);
        long rejected = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED);
        Double avgScore = evaluationRepository.avgScoreByUserId(userId);

        return MyKpiProgressResponse.builder()
                .totalAssignedKpi(totalAssigned)
                .totalSubmissions(totalSubmissions)
                .approvedSubmissions(approved)
                .pendingSubmissions(pending)
                .rejectedSubmissions(rejected)
                .averageScore(avgScore)
                .build();
    }
}
