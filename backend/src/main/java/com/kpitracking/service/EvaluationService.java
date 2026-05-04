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

import java.util.Objects;
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
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatedUserAssignments = userRoleOrgUnitRepository.findByUserId(evaluatedUser.getId());
        if (evaluatedUserAssignments.isEmpty()) {
            throw new BusinessException("Người dùng chưa được phân bổ vào đơn vị nào");
        }
        OrgUnit targetOrgUnit = evaluatedUserAssignments.get(0).getOrgUnit();
        com.kpitracking.entity.Organization org = targetOrgUnit.getOrgHierarchyLevel().getOrganization();

        if (request.getScore() > org.getEvaluationMaxScore()) {
            throw new BusinessException("Điểm số không được vượt quá " + org.getEvaluationMaxScore());
        }

        boolean isSelfEval = currentUser.getId().equals(evaluatedUser.getId());
        boolean canEvaluateOthers = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "EVALUATION:CREATE", targetOrgUnit.getId());

        if (!isSelfEval) {
            if (!canEvaluateOthers) {
                throw new ForbiddenException("Bạn không có quyền tạo đánh giá cho người khác");
            }
            
            // Hierarchy check: can only evaluate subordinates
            java.util.List<com.kpitracking.entity.UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            Integer viewerRank = currentAssignments.stream().map(a -> a.getRole().getRank()).filter(Objects::nonNull).min(Integer::compare).orElse(2);
            Integer viewerLevel = currentAssignments.stream().map(a -> a.getRole().getLevel()).filter(Objects::nonNull).min(Integer::compare).orElse(2);

            boolean isSubordinate = evaluatedUserAssignments.stream().anyMatch(assignment -> {
                Integer subRank = assignment.getRole().getRank();
                Integer subLevel = assignment.getRole().getLevel();
                return (subLevel > viewerLevel || (subLevel.equals(viewerLevel) && subRank > viewerRank));
            });

            if (!isSubordinate) {
                throw new ForbiddenException("Bạn chỉ có quyền đánh giá cấp dưới");
            }
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
        
        // Find the single most senior role (lowest level, then lowest rank)
        com.kpitracking.entity.Role bestRole = currentAssignments.stream()
                .map(com.kpitracking.entity.UserRoleOrgUnit::getRole)
                .filter(java.util.Objects::nonNull)
                .sorted(java.util.Comparator.comparing(com.kpitracking.entity.Role::getLevel)
                        .thenComparing(com.kpitracking.entity.Role::getRank))
                .findFirst()
                .orElse(null);

        Integer viewerLevel = (bestRole != null) ? bestRole.getLevel() : 2;
        Integer viewerRank = (bestRole != null) ? bestRole.getRank() : 2;

        Page<Evaluation> evalPage = evaluationRepository.findAllWithFilters(
                currentUser.getId(),
                allowedOrgUnitIds,
                userId,
                kpiPeriodId,
                orgUnitPath,
                null,
                viewerRank,
                viewerLevel,
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
    public EvaluationResponse getEvaluationById(UUID id) {
        Evaluation evaluation = evaluationRepository.findById(id)
                .orElseThrow(() -> new com.kpitracking.exception.ResourceNotFoundException("Evaluation", "id", id));

        com.kpitracking.entity.User currentUser = getCurrentUser();
        
        // Grant access if it's the user's own evaluation
        if (evaluation.getUser().getId().equals(currentUser.getId())) {
            return enrichResponse(evaluation);
        }

        // Director or Global Admin can see everything
        boolean isGlobalAdmin = permissionChecker.isGlobalAdmin(currentUser.getId());
        if (isGlobalAdmin) {
            return enrichResponse(evaluation);
        }

        // Otherwise check hierarchy
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        
        // Find the single most senior role (lowest level, then lowest rank)
        com.kpitracking.entity.Role bestRole = currentAssignments.stream()
                .map(com.kpitracking.entity.UserRoleOrgUnit::getRole)
                .filter(java.util.Objects::nonNull)
                .sorted(java.util.Comparator.comparing(com.kpitracking.entity.Role::getLevel)
                        .thenComparing(com.kpitracking.entity.Role::getRank))
                .findFirst()
                .orElse(null);

        Integer viewerLevel = (bestRole != null) ? bestRole.getLevel() : 2;
        Integer viewerRank = (bestRole != null) ? bestRole.getRank() : 2;

        if (viewerLevel == 0) {
            return enrichResponse(evaluation);
        }

        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatedAssignments = userRoleOrgUnitRepository.findByUserId(evaluation.getUser().getId());
        
        boolean hasSubordinateRole = evaluatedAssignments.stream().anyMatch(uro -> {
            Integer subLevel = uro.getRole().getLevel();
            Integer subRank = uro.getRole().getRank();
            if (subLevel == null || subRank == null) return false;
            return subLevel > viewerLevel || (subLevel.equals(viewerLevel) && subRank > viewerRank);
        });

        boolean hasSuperiorOrEqualRole = evaluatedAssignments.stream().anyMatch(uro -> {
            Integer subLevel = uro.getRole().getLevel();
            Integer subRank = uro.getRole().getRank();
            if (subLevel == null || subRank == null) return false;
            return subLevel < viewerLevel || (subLevel.equals(viewerLevel) && subRank <= viewerRank);
        });

        if (!hasSubordinateRole || hasSuperiorOrEqualRole) {
            throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xem bản đánh giá này");
        }

        return enrichResponse(evaluation);
    }

    private EvaluationResponse enrichResponse(Evaluation evaluation) {
        EvaluationResponse response = evaluationMapper.toResponse(evaluation);
        
        // Populate evaluated user's best position
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> userUro = userRoleOrgUnitRepository.findByUserId(evaluation.getUser().getId());
        com.kpitracking.entity.Role userBestRole = userUro.stream()
                .map(com.kpitracking.entity.UserRoleOrgUnit::getRole)
                .filter(java.util.Objects::nonNull)
                .sorted(java.util.Comparator.comparing(com.kpitracking.entity.Role::getLevel)
                        .thenComparing(com.kpitracking.entity.Role::getRank))
                .findFirst()
                .orElse(null);

        if (userBestRole != null) {
            response.setUserLevel(userBestRole.getLevel());
            response.setUserRank(userBestRole.getRank());
        }

        // Set evaluator label based on role
        if (evaluation.getEvaluator() != null) {
            if (evaluation.getEvaluator().getId().equals(evaluation.getUser().getId())) {
                response.setEvaluatorRole("SELF");
            } else {
                java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatorUro = userRoleOrgUnitRepository.findByUserId(evaluation.getEvaluator().getId());
                
                // Find the single most senior role of the evaluator
                com.kpitracking.entity.Role bestRole = evaluatorUro.stream()
                        .map(com.kpitracking.entity.UserRoleOrgUnit::getRole)
                        .filter(java.util.Objects::nonNull)
                        .sorted(java.util.Comparator.comparing(com.kpitracking.entity.Role::getLevel)
                                .thenComparing(com.kpitracking.entity.Role::getRank))
                        .findFirst()
                        .orElse(null);

                String roleLabel = "MANAGER"; // Default
                
                if (bestRole != null) {
                    Integer minLevel = bestRole.getLevel();
                    Integer minRank = bestRole.getRank();

                    if (minLevel == 0 && minRank == 0) {
                        roleLabel = "DIRECTOR";
                    } else if (minLevel == 1) {
                        roleLabel = minRank == 0 ? "DEPT_HEAD" : "DEPT_DEPUTY";
                    } else if (minLevel == 2) {
                        roleLabel = minRank == 0 ? "TEAM_LEADER" : (minRank == 1 ? "TEAM_DEPUTY" : "STAFF");
                    }
                }
                
                response.setEvaluatorRole(roleLabel);
            }
        }
        
        return response;
    }
}
