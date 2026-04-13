package com.kpitracking.service;

import com.kpitracking.dto.response.stats.DeptKpiStatsResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
import com.kpitracking.entity.Department;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
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
        UUID companyId = getCurrentUser().getCompany().getId();

        return OverviewStatsResponse.builder()
                .totalUsers(userRepository.countByCompanyId(companyId))
                .totalDepartments(departmentRepository.countByCompanyId(companyId))
                .totalKpiCriteria(kpiCriteriaRepository.countByCompanyId(companyId))
                .approvedKpi(kpiCriteriaRepository.countByCompanyIdAndStatus(companyId, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByCompanyIdAndStatus(companyId, KpiStatus.PENDING_APPROVAL))
                .totalSubmissions(submissionRepository.countByCompanyId(companyId))
                .pendingSubmissions(submissionRepository.countByCompanyIdAndStatus(companyId, SubmissionStatus.PENDING))
                .approvedSubmissions(submissionRepository.countByCompanyIdAndStatus(companyId, SubmissionStatus.APPROVED))
                .rejectedSubmissions(submissionRepository.countByCompanyIdAndStatus(companyId, SubmissionStatus.REJECTED))
                .totalEvaluations(evaluationRepository.countByCompanyId(companyId))
                .build();
    }

    @Transactional(readOnly = true)
    public List<DeptKpiStatsResponse> getDepartmentKpiStats() {
        UUID companyId = getCurrentUser().getCompany().getId();
        List<Department> departments = departmentRepository.findAllByCompanyId(companyId);

        return departments.stream().map(dept -> DeptKpiStatsResponse.builder()
                .departmentId(dept.getId())
                .departmentName(dept.getName())
                .totalKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentId(companyId, dept.getId()))
                .approvedKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.REJECTED))
                .build()
        ).toList();
    }

    @Transactional(readOnly = true)
    public MyKpiProgressResponse getMyKpiProgress() {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        UUID userId = currentUser.getId();

        long totalAssigned = kpiCriteriaRepository.countMyAssignedKpis(companyId, KpiStatus.APPROVED, userId);
        long totalSubmissions = submissionRepository.countByCompanyIdAndSubmittedById(companyId, userId);
        long approved = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(
                companyId, userId, SubmissionStatus.APPROVED);
        long pending = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(
                companyId, userId, SubmissionStatus.PENDING);
        long rejected = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(
                companyId, userId, SubmissionStatus.REJECTED);
        Double avgScore = evaluationRepository.avgScoreByCompanyIdAndUserId(companyId, userId);

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
