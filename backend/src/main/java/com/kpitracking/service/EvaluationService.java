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

        if (currentUser.getId().equals(evaluatedUser.getId())) {
            throw new com.kpitracking.exception.BusinessException("Cannot evaluate yourself");
        }

        if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            boolean isHeadOfEvaluatedUser = departmentRepository.findByCompanyId(companyId, PageRequest.of(0, 100))
                    .getContent().stream()
                    .filter(dept -> dept.getHead() != null && dept.getHead().getId().equals(currentUser.getId()))
                    .anyMatch(dept -> departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), evaluatedUser.getId()));

            if (!isHeadOfEvaluatedUser) {
                throw new com.kpitracking.exception.ForbiddenException("You can only evaluate members of your department");
            }
        }

        Evaluation evaluation = Evaluation.builder()
                .company(company)
                .user(evaluatedUser)
                .kpiCriteria(kpiCriteria)
                .evaluator(currentUser)
                .score(request.getScore())
                .comment(request.getComment())
                .periodStart(request.getPeriodStart())
                .periodEnd(request.getPeriodEnd())
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

        UUID effectiveUserId = userId;

        if (!isDirector && !isHead) {
            if (effectiveUserId != null && !effectiveUserId.equals(currentUser.getId())) {
                throw new com.kpitracking.exception.ForbiddenException("You can only view your own evaluations");
            }
            effectiveUserId = currentUser.getId(); // ✅ OK vì là biến mới
        } else if (isHead && !isDirector) {
            if (effectiveUserId != null && !effectiveUserId.equals(currentUser.getId())) {

                final UUID finalUserId = effectiveUserId; // ✅ dùng trong lambda

                boolean isEvaluatedMyDept = departmentRepository.findByCompanyId(companyId, PageRequest.of(0, 100))
                        .getContent().stream()
                        .filter(dept -> dept.getHead() != null && dept.getHead().getId().equals(currentUser.getId()))
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
            if (!isDirector) {
                throw new com.kpitracking.exception.BusinessException("You must specify a userId to filter evaluations");
            }
            evalPage = evaluationRepository.findByCompanyId(companyId, pageable);
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
