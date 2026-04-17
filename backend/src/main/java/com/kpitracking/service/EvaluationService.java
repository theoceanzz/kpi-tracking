package com.kpitracking.service;

import com.kpitracking.dto.request.evaluation.CreateEvaluationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.EvaluationMapper;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
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
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final EvaluationMapper evaluationMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    @Transactional
    public EvaluationResponse createEvaluation(CreateEvaluationRequest request) {
        User currentUser = getCurrentUser();

        User evaluatedUser = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        KpiCriteria kpiCriteria = kpiCriteriaRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", request.getKpiCriteriaId()));

        if (currentUser.getId().equals(evaluatedUser.getId())) {
            throw new BusinessException("Cannot evaluate yourself");
        }

        if (!hasRole(currentUser.getId(), "DIRECTOR") && !hasRole(currentUser.getId(), "HEAD")) {
            throw new ForbiddenException("Only DIRECTOR or HEAD can create evaluations");
        }

        Evaluation evaluation = Evaluation.builder()
                .orgUnit(kpiCriteria.getOrgUnit())
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
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");
        boolean isHead = hasRole(currentUser.getId(), "HEAD");

        Page<Evaluation> evalPage;

        UUID effectiveUserId = userId;

        if (!isDirector && !isHead) {
            effectiveUserId = currentUser.getId();
        }

        if (effectiveUserId != null) {
            evalPage = evaluationRepository.findByUserId(effectiveUserId, pageable);
        } else if (kpiCriteriaId != null) {
            evalPage = evaluationRepository.findByKpiCriteriaId(kpiCriteriaId, pageable);
        } else {
            evalPage = evaluationRepository.findAll(pageable);
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
        Evaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation", "id", evaluationId));
        return evaluationMapper.toResponse(evaluation);
    }
}
