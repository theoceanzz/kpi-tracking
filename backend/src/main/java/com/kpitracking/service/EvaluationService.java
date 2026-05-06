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

import java.util.*;
import java.util.stream.Collectors;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.entity.KpiSubmission;

@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
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
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "EVALUATION:CREATE");
        OrgUnit targetOrgUnit = evaluatedUserAssignments.stream()
                .filter(a -> allowedOrgUnitIds.contains(a.getOrgUnit().getId()))
                .map(com.kpitracking.entity.UserRoleOrgUnit::getOrgUnit)
                .findFirst()
                .orElse(evaluatedUserAssignments.get(0).getOrgUnit());
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
            // Hierarchy check: can only evaluate subordinates
            int viewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), targetOrgUnit.getId());
            int viewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), targetOrgUnit.getId());

            // Deputy (Rank 1) and Staff (Rank 2) cannot evaluate others
            if (viewerRank > 0) {
                throw new ForbiddenException("Chỉ cấp Trưởng mới có quyền thực hiện đánh giá cho nhân viên.");
            }

            boolean isSubordinate = evaluatedUserAssignments.stream().anyMatch(assignment -> {
                int subLevel = assignment.getRole().getLevel();
                int subRank = assignment.getRole().getRank();
                // Subordinate is lower level OR same level but lower rank
                return (subLevel > viewerLevel || (subLevel == viewerLevel && subRank > viewerRank));
            });

            if (!isSubordinate) {
                throw new ForbiddenException("Bạn chỉ có quyền đánh giá cấp dưới trực tiếp trong sơ đồ tổ chức.");
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
                .systemScore(calculateSystemScore(evaluatedUser.getId(), kpiPeriod.getId(), (double) org.getEvaluationMaxScore()))
                .build();

        evaluation = evaluationRepository.save(evaluation);
        return enrichResponse(evaluation);
    }

    private Double calculateSystemScore(UUID userId, UUID kpiPeriodId, Double maxScore) {
        // Find all KPIs assigned to user for this period
        List<KpiStatus> activeKpiStatuses = Arrays.asList(
                KpiStatus.APPROVED, 
                KpiStatus.EDITED, 
                KpiStatus.EDIT
        );
        
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                userId, kpiPeriodId, activeKpiStatuses, Pageable.unpaged()).getContent();
        
        if (kpis.isEmpty()) return 0.0;
        
        Set<UUID> kpiIds = kpis.stream()
                .map(KpiCriteria::getId)
                .collect(Collectors.toSet());
        
        // Find all submissions for these KPIs by this user
        List<KpiSubmission> submissions = kpiSubmissionRepository.findBySubmittedByUserIdAndKpiCriteriaIdIn(
                userId, kpiIds);
                
        double total = submissions.stream()
                .filter(s -> s.getStatus() != SubmissionStatus.DRAFT)
                .mapToDouble(s -> s.getAutoScore() != null ? s.getAutoScore() : 0.0)
                .sum();
                
        return Math.min(maxScore, (double) Math.round(total));
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
        
        Integer viewerLevel;
        Integer viewerRank;
        if (orgUnitId != null) {
            viewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), orgUnitId);
            viewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), orgUnitId);
        } else {
            // No orgUnit filter — use the user's best (lowest) level/rank across all assignments
            viewerLevel = currentAssignments.stream()
                    .map(a -> a.getRole().getLevel())
                    .filter(Objects::nonNull)
                    .min(Integer::compare)
                    .orElse(4);
            viewerRank = currentAssignments.stream()
                    .filter(a -> a.getRole().getLevel() != null && a.getRole().getLevel().equals(viewerLevel))
                    .map(a -> a.getRole().getRank())
                    .filter(Objects::nonNull)
                    .min(Integer::compare)
                    .orElse(0);
        }

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
        // We check if the viewer is superior to the evaluated user in ANY of the evaluated user's units
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatedAssignments = userRoleOrgUnitRepository.findByUserId(evaluation.getUser().getId());
        
        boolean isSuperior = evaluatedAssignments.stream().anyMatch(uro -> {
            UUID unitId = uro.getOrgUnit().getId();
            int viewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), unitId);
            int viewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), unitId);
            
            Integer subLevel = uro.getRole().getLevel();
            Integer subRank = uro.getRole().getRank();
            
            if (subLevel == null || subRank == null) return false;
            
            return viewerLevel < subLevel || (viewerLevel == subLevel && viewerRank < subRank);
        });

        if (!isSuperior) {
            throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xem bản đánh giá này vì không phải là cấp trên của nhân viên.");
        }

        return enrichResponse(evaluation);
    }

    private EvaluationResponse enrichResponse(Evaluation evaluation) {
        EvaluationResponse response = evaluationMapper.toResponse(evaluation);
        
        // Populate evaluated user's best position (Highest unit but not root)
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> userUro = userRoleOrgUnitRepository.findByUserId(evaluation.getUser().getId());
        com.kpitracking.entity.UserRoleOrgUnit bestUro = userUro.stream()
                .filter(uro -> uro.getRole() != null)
                .sorted(java.util.Comparator.comparing(uro -> {
                    int lo = uro.getOrgUnit().getOrgHierarchyLevel().getLevelOrder();
                    return lo == 0 ? 999 : lo;
                }))
                .findFirst()
                .orElse(userUro.isEmpty() ? null : userUro.get(0));

        if (bestUro != null && bestUro.getRole() != null) {
            response.setUserLevel(bestUro.getRole().getLevel());
            response.setUserRank(bestUro.getRole().getRank());
            response.setUserRoleName(bestUro.getRole().getName());
            response.setOrgUnitName(bestUro.getOrgUnit().getName());
        }

        // Set evaluator label based on role code for frontend compatibility
        if (evaluation.getEvaluator() != null) {
            if (evaluation.getEvaluator().getId().equals(evaluation.getUser().getId())) {
                response.setEvaluatorRole("SELF");
            } else {
                java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatorUro = userRoleOrgUnitRepository.findByUserId(evaluation.getEvaluator().getId());
                
                // Find the best role of the evaluator in the context of this evaluation's unit
                com.kpitracking.entity.UserRoleOrgUnit bestEvalUro = evaluatorUro.stream()
                        .filter(uro -> evaluation.getOrgUnit().getPath().startsWith(uro.getOrgUnit().getPath()))
                        .sorted(java.util.Comparator.comparing((com.kpitracking.entity.UserRoleOrgUnit uro) -> uro.getRole().getLevel())
                                .thenComparing(uro -> uro.getRole().getRank()))
                        .findFirst()
                        .orElse(evaluatorUro.isEmpty() ? null : evaluatorUro.get(0));

                if (bestEvalUro != null && bestEvalUro.getRole() != null) {
                    com.kpitracking.entity.Role r = bestEvalUro.getRole();
                    int roleLevel = r.getLevel();
                    int roleRank = r.getRank();
                    response.setOrgUnitLevel(evaluation.getOrgUnit().getOrgHierarchyLevel().getLevelOrder());

                    if (roleLevel == 0) {
                        response.setEvaluatorRole("DIRECTOR");
                    } else if (roleLevel == 1) {
                        response.setEvaluatorRole("REGIONAL_DIRECTOR");
                    } else if (roleLevel == 2) {
                        response.setEvaluatorRole("MANAGER");
                    } else if (roleLevel == 3) {
                        response.setEvaluatorRole("DEPT_HEAD");
                    } else if (roleLevel == 4) {
                        response.setEvaluatorRole("TEAM_LEADER");
                    } else {
                        response.setEvaluatorRole("MANAGER");
                    }
                } else {
                    response.setEvaluatorRole("MANAGER");
                }
            }
        }
        
        return response;
    }
}
