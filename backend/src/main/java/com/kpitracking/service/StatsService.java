package com.kpitracking.service;

import com.kpitracking.dto.response.stats.DeptKpiStatsResponse;
import com.kpitracking.dto.response.stats.EmployeeKpiStatsResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
import com.kpitracking.entity.Department;
import com.kpitracking.entity.DepartmentMember;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final DepartmentMemberRepository departmentMemberRepository;
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
                .totalKpiCriteria(kpiCriteriaRepository.countByCompanyIdAndStatus(companyId, KpiStatus.APPROVED))
                .approvedKpi(kpiCriteriaRepository.countByCompanyIdAndStatus(companyId, KpiStatus.APPROVED))
                .pendingKpi(0)
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
                .memberCount(departmentMemberRepository.countByDepartmentId(dept.getId()))
                .totalKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(companyId, dept.getId(), KpiStatus.APPROVED))
                .approvedKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), KpiStatus.REJECTED))
                .totalSubmissions(submissionRepository.countByCompanyIdAndDepartmentId(companyId, dept.getId()))
                .approvedSubmissions(submissionRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByCompanyIdAndDepartmentIdAndStatus(
                        companyId, dept.getId(), SubmissionStatus.REJECTED))
                .build()
        ).toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeKpiStatsResponse> getEmployeeKpiStats() {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        List<User> users = userRepository.findAllByCompanyId(companyId).stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .collect(Collectors.toList());

        List<EmployeeKpiStatsResponse> result = new ArrayList<>();

        for (User u : users) {
             List<DepartmentMember> dms = departmentMemberRepository.findByUserId(u.getId());
             String deptNames = dms.stream()
                     .map(dm -> dm.getDepartment().getName())
                     .collect(Collectors.joining(", "));

             long assignedKpi = kpiCriteriaRepository.countMyAssignedKpis(companyId, KpiStatus.APPROVED, u.getId());
             long totalSub = submissionRepository.countByCompanyIdAndSubmittedById(companyId, u.getId());
             long approvedSub = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(companyId, u.getId(), SubmissionStatus.APPROVED);
             long pendingSub = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(companyId, u.getId(), SubmissionStatus.PENDING);
             long rejectedSub = submissionRepository.countByCompanyIdAndSubmittedByIdAndStatus(companyId, u.getId(), SubmissionStatus.REJECTED);
             Double avgScore = evaluationRepository.avgScoreByCompanyIdAndUserId(companyId, u.getId());

             result.add(EmployeeKpiStatsResponse.builder()
                     .userId(u.getId())
                     .fullName(u.getFullName())
                     .email(u.getEmail())
                     .role(u.getRole().name())
                     .departmentName(deptNames)
                     .assignedKpi(assignedKpi)
                     .totalSubmissions(totalSub)
                     .approvedSubmissions(approvedSub)
                     .pendingSubmissions(pendingSub)
                     .rejectedSubmissions(rejectedSub)
                     .averageScore(avgScore)
                     .build());
        }

        // Sort by approvedSubmissions descending (top performers first)
        result.sort((a, b) -> Long.compare(b.getApprovedSubmissions(), a.getApprovedSubmissions()));
        return result;
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
