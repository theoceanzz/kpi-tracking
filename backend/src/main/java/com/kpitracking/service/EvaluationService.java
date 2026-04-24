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
import com.kpitracking.repository.*;
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
    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final EvaluationMapper evaluationMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    @Transactional
    public EvaluationResponse createEvaluation(CreateEvaluationRequest request) {
        User currentUser = getCurrentUser();

        User evaluatedUser = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getUserId()));

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));

        boolean isSelfEval = currentUser.getId().equals(evaluatedUser.getId());
        boolean isManager = hasRole(currentUser.getId(), "DIRECTOR") || hasRole(currentUser.getId(), "HEAD");

        if (!isSelfEval && !isManager) {
            throw new ForbiddenException("Bạn không có quyền tạo đánh giá cho người khác");
        }

        if (isSelfEval) {
            boolean exists = evaluationRepository.existsByUserIdAndKpiPeriodIdAndEvaluatorId(
                    evaluatedUser.getId(), kpiPeriod.getId(), currentUser.getId());
            if (exists) {
                throw new com.kpitracking.exception.BusinessException("Bạn đã thực hiện tự đánh giá cho đợt này rồi.");
            }
        }

        // Get user's primary org unit for linking
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> uro = userRoleOrgUnitRepository.findByUserId(evaluatedUser.getId());
        if (uro.isEmpty()) {
            throw new BusinessException("Người dùng chưa được phân bổ vào đơn vị nào");
        }

        Evaluation evaluation = Evaluation.builder()
                .orgUnit(uro.get(0).getOrgUnit())
                .user(evaluatedUser)
                .kpiPeriod(kpiPeriod)
                .evaluator(currentUser)
                .score(request.getScore())
                .comment(request.getComment())
                .build();

        evaluation = evaluationRepository.save(evaluation);
        return evaluationMapper.toResponse(evaluation);
    }

    @Transactional(readOnly = true)
    public PageResponse<EvaluationResponse> getEvaluations(int page, int size, String sortBy, String sortDir, UUID userId, UUID kpiPeriodId, UUID orgUnitId) {
        User currentUser = getCurrentUser();
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");
        boolean isHead = hasRole(currentUser.getId(), "HEAD");

        UUID effectiveUserId = userId;
        UUID effectiveOrgUnitId = orgUnitId;

        // Force scope filtering for STAFF
        if (!isDirector && !isHead) {
            effectiveUserId = currentUser.getId();
            effectiveOrgUnitId = null;
        }

        String orgUnitPath = null;
        if (effectiveOrgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(effectiveOrgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        } else if (isHead && effectiveUserId == null) {
            // Heads see their department evaluations by default
            effectiveOrgUnitId = userRoleOrgUnitRepository.findByUserId(currentUser.getId()).get(0).getOrgUnit().getId();
            orgUnitPath = orgUnitRepository.findById(effectiveOrgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        Page<Evaluation> evalPage = evaluationRepository.findAllWithFilters(effectiveUserId, kpiPeriodId, orgUnitPath, null, pageable);

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
