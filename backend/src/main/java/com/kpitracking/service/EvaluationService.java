package com.kpitracking.service;

import com.kpitracking.dto.request.evaluation.CreateEvaluationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.EvaluationMapper;
import com.kpitracking.repository.*;
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
    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
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

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));

        // Get user's primary org unit for linking
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> uro = userRoleOrgUnitRepository.findByUserId(evaluatedUser.getId());
        if (uro.isEmpty()) {
            throw new BusinessException("Người dùng chưa được phân bổ vào đơn vị nào");
        }
        OrgUnit targetOrgUnit = uro.get(0).getOrgUnit();
        com.kpitracking.entity.Organization org = targetOrgUnit.getOrgHierarchyLevel().getOrganization();

        if (request.getScore() > org.getEvaluationMaxScore()) {
            throw new BusinessException("Điểm số không được vượt quá " + org.getEvaluationMaxScore());
        }

        boolean isSelfEval = currentUser.getId().equals(evaluatedUser.getId());
        boolean canEvaluateOthers = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "EVALUATION:CREATE", targetOrgUnit.getId());

        if (!isSelfEval && !canEvaluateOthers) {
            throw new ForbiddenException("Bạn không có quyền tạo đánh giá cho nhân viên này");
        }

        if (isSelfEval) {
            boolean exists = evaluationRepository.existsByUserIdAndKpiPeriodIdAndEvaluatorId(
                    evaluatedUser.getId(), kpiPeriod.getId(), currentUser.getId());
            if (exists) {
                throw new com.kpitracking.exception.BusinessException("Bạn đã thực hiện tự đánh giá cho đợt này rồi.");
            }
        }

        Evaluation evaluation = Evaluation.builder()
                .orgUnit(targetOrgUnit)
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
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "EVALUATION:VIEW");

        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        Integer currentUserRank = currentAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        Page<Evaluation> evalPage = evaluationRepository.findAllWithFilters(
                currentUser.getId(),
                allowedOrgUnitIds,
                userId,
                kpiPeriodId,
                orgUnitPath,
                null,
                currentUserRank,
                pageable
        );

        return PageResponse.<EvaluationResponse>builder()
                .content(evalPage.getContent().stream().map(this::enrichResponse).toList())
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
        Evaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản đánh giá", "id", evaluationId));

        boolean isGlobalAdmin = permissionChecker.isGlobalAdmin(currentUser.getId());
        boolean hasViewPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "EVALUATION:VIEW", evaluation.getOrgUnit().getId());
        boolean isEvaluatedUser = evaluation.getUser().getId().equals(currentUser.getId());
        boolean isEvaluator = evaluation.getEvaluator().getId().equals(currentUser.getId());

        if (!isGlobalAdmin && !hasViewPermission && !isEvaluatedUser && !isEvaluator) {
            throw new ForbiddenException("Bạn không có quyền xem bản đánh giá này");
        }

        return enrichResponse(evaluation);
    }

    private EvaluationResponse enrichResponse(Evaluation evaluation) {
        EvaluationResponse resp = evaluationMapper.toResponse(evaluation);
        if (evaluation.getEvaluator() != null) {
            if (evaluation.getEvaluator().getId().equals(evaluation.getUser().getId())) {
                resp.setEvaluatorRole("SELF");
            } else if (permissionChecker.isGlobalAdmin(evaluation.getEvaluator().getId())) {
                resp.setEvaluatorRole("DIRECTOR");
            } else {
                // Determine if it's TEAM_LEADER or DEPT_HEAD based on evaluator's org unit level
                java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatorUro = userRoleOrgUnitRepository.findByUserId(evaluation.getEvaluator().getId());
                if (!evaluatorUro.isEmpty()) {
                    int level = evaluatorUro.get(0).getOrgUnit().getOrgHierarchyLevel().getLevelOrder();
                    // Level 2 is typically Department, Level 3+ is Team
                    if (level >= 3) {
                        resp.setEvaluatorRole("TEAM_LEADER");
                    } else if (level == 2) {
                        resp.setEvaluatorRole("DEPT_HEAD");
                    } else {
                        resp.setEvaluatorRole("MANAGER");
                    }
                } else {
                    resp.setEvaluatorRole("MANAGER");
                }
            }
        }
        if (evaluation.getOrgUnit() != null && evaluation.getOrgUnit().getOrgHierarchyLevel() != null) {
            resp.setOrgUnitLevel(evaluation.getOrgUnit().getOrgHierarchyLevel().getLevelOrder());
        }
        return resp;
    }
}
