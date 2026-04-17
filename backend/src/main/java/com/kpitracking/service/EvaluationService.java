package com.kpitracking.service;

import com.kpitracking.dto.request.evaluation.CreateEvaluationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Company;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.EvaluationMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final com.kpitracking.repository.DepartmentMemberRepository departmentMemberRepository;
    private final com.kpitracking.repository.DepartmentRepository departmentRepository;
    private final EvaluationMapper evaluationMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public EvaluationResponse createEvaluation(CreateEvaluationRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        User evaluatedUser = userRepository.findByIdAndCompanyId(request.getUserId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        KpiCriteria kpiCriteria = kpiCriteriaRepository.findByIdAndCompanyId(request.getKpiCriteriaId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", request.getKpiCriteriaId()));

        // Permission check:
        // 1. Director can evaluate anyone.
        // 2. User can evaluate themselves (Self-Evaluation).
        // 3. Head can evaluate members of their department.
        boolean isSelfEvaluation = currentUser.getId().equals(evaluatedUser.getId());
        
        if (!isSelfEvaluation && currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            boolean isHeadOfEvaluatedUser = departmentRepository.findByCompanyId(companyId, PageRequest.of(0, 100))
                    .getContent().stream()
                    .filter(dept -> dept.getHead() != null && dept.getHead().getId().equals(currentUser.getId()))
                    .anyMatch(dept -> departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), evaluatedUser.getId()));

            if (!isHeadOfEvaluatedUser) {
                throw new com.kpitracking.exception.ForbiddenException("You can only evaluate yourself or members of your department");
            }
        }

        Evaluation evaluation = Evaluation.builder()
                .company(company)
                .user(evaluatedUser)
                .kpiCriteria(kpiCriteria)
                .evaluator(currentUser)
                .score(request.getScore())
                .comment(request.getComment())
                .periodStart(request.getPeriodStart() != null ? request.getPeriodStart().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .periodEnd(request.getPeriodEnd() != null ? request.getPeriodEnd().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .build();

        evaluation = evaluationRepository.save(evaluation);
        return evaluationMapper.toResponse(evaluation);
    }

    @Transactional(readOnly = true)
    public PageResponse<EvaluationResponse> getEvaluations(int page, int size, UUID userId, UUID kpiCriteriaId) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<Evaluation> evalPage;

        boolean isDirector = currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR;
        boolean isHead = currentUser.getRole() == com.kpitracking.enums.UserRole.HEAD;
        boolean isDeputy = currentUser.getRole() == com.kpitracking.enums.UserRole.DEPUTY;

        UUID effectiveUserId = userId;

        if (!isDirector && !isHead && !isDeputy) {
            if (effectiveUserId != null && !effectiveUserId.equals(currentUser.getId())) {
                throw new com.kpitracking.exception.ForbiddenException("You can only view your own evaluations");
            }
            effectiveUserId = currentUser.getId(); // ✅ OK vì là biến mới
        } else if ((isHead || isDeputy) && !isDirector) {
            if (effectiveUserId != null && !effectiveUserId.equals(currentUser.getId())) {

                final UUID finalUserId = effectiveUserId; // ✅ dùng trong lambda

                boolean isEvaluatedMyDept = departmentRepository.findByHeadIdOrDeputyId(currentUser.getId(), currentUser.getId())
                        .stream()
                        .anyMatch(dept -> departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), finalUserId));

                if (!isEvaluatedMyDept) {
                    throw new com.kpitracking.exception.ForbiddenException("You can only view evaluations for your department members");
                }
            }
        }

        if (effectiveUserId != null) {
            evalPage = evaluationRepository.findByCompanyIdAndUserId(companyId, effectiveUserId, pageable);
        } else if (kpiCriteriaId != null) {
            evalPage = evaluationRepository.findByCompanyIdAndKpiCriteriaId(companyId, kpiCriteriaId, pageable);
        } else {
            if (isDirector) {
                evalPage = evaluationRepository.findByCompanyId(companyId, pageable);
            } else if (isHead || isDeputy) {
                java.util.List<com.kpitracking.entity.Department> managedDepts = departmentRepository.findByHeadIdOrDeputyId(currentUser.getId(), currentUser.getId());
                if (managedDepts.isEmpty()) {
                    evalPage = Page.empty(pageable);
                } else {
                    java.util.List<UUID> managedDeptIds = managedDepts.stream().map(com.kpitracking.entity.Department::getId).toList();
                    evalPage = evaluationRepository.findByCompanyIdAndKpiCriteriaDepartmentIdIn(companyId, managedDeptIds, pageable);
                }
            } else {
                throw new com.kpitracking.exception.ForbiddenException("Only DIRECTOR, HEAD or DEPUTY can view all evaluations");
            }
        }

        return PageResponse.<EvaluationResponse>builder()
                .content(evalPage.getContent().stream().map(evaluationMapper::toResponse).toList())
                .page(evalPage.getNumber())
                .size(evalPage.getSize())
                .totalElements(evalPage.getTotalElements())
                .totalPages(evalPage.getTotalPages())
                .last(evalPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public EvaluationResponse getEvaluationById(UUID evaluationId) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Evaluation evaluation = evaluationRepository.findByIdAndCompanyId(evaluationId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation", "id", evaluationId));

        if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR &&
            currentUser.getRole() != com.kpitracking.enums.UserRole.HEAD &&
            !evaluation.getUser().getId().equals(currentUser.getId())) {
             throw new com.kpitracking.exception.ForbiddenException("You do not have permission to view this evaluation");
        }

        return evaluationMapper.toResponse(evaluation);
    }
}
