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
import com.kpitracking.security.PermissionChecker;
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
    private final EvaluationMapper evaluationMapper;
    private final PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    @Transactional
    public EvaluationResponse createEvaluation(CreateEvaluationRequest request) {
        User currentUser = getCurrentUser();

        User evaluatedUser = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getUserId()));

        KpiCriteria kpiCriteria = kpiCriteriaRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", request.getKpiCriteriaId()));

        boolean isSelfEval = currentUser.getId().equals(evaluatedUser.getId());
        boolean canEvaluateOthers = permissionChecker.hasPermission(currentUser.getId(), "EVALUATION:CREATE");

        if (!isSelfEval && !canEvaluateOthers) {
            throw new ForbiddenException("Bạn không có quyền tạo đánh giá cho người khác");
        }

        // Validation of period dates against KPI criteria range
        java.time.LocalDate kpiStart = kpiCriteria.getStartDate() != null ? kpiCriteria.getStartDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;
        java.time.LocalDate kpiEnd = kpiCriteria.getEndDate() != null ? kpiCriteria.getEndDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;

        if (request.getPeriodStart() != null && kpiStart != null && request.getPeriodStart().isBefore(kpiStart)) {
            throw new BusinessException("Ngày bắt đầu đánh giá không được trước ngày bắt đầu của KPI (" + kpiStart + ")");
        }
        if (request.getPeriodEnd() != null && kpiEnd != null && request.getPeriodEnd().isAfter(kpiEnd)) {
            throw new BusinessException("Ngày kết thúc đánh giá không được sau ngày kết thúc của KPI (" + kpiEnd + ")");
        }
        if (request.getPeriodStart() != null && request.getPeriodEnd() != null && request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException("Ngày kết thúc không được trước ngày bắt đầu");
        }

        Evaluation evaluation = Evaluation.builder()
                .orgUnit(kpiCriteria.getOrgUnit())
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
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        boolean canViewAll = permissionChecker.hasAnyPermission(currentUser.getId(), "EVALUATION:VIEW", "EVALUATION:CREATE");

        Page<Evaluation> evalPage;

        UUID effectiveUserId = userId;

        if (!canViewAll) {
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
                .orElseThrow(() -> new ResourceNotFoundException("Bản đánh giá", "id", evaluationId));
        return evaluationMapper.toResponse(evaluation);
    }
}
