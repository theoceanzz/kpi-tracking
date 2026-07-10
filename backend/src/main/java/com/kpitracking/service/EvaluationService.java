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

import java.time.Instant;
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
    private final KpiCriteriaService kpiCriteriaService;
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
        // Get authorized units considering hierarchy inheritance
        // Prioritize units where the viewer is actually a "Trưởng" (Rank 0)
        OrgUnit targetOrgUnit = evaluatedUserAssignments.stream()
                .filter(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "EVALUATION:CREATE", a.getOrgUnit().getId()))
                .sorted(java.util.Comparator.comparingInt(a -> permissionChecker.getMinRankInOrgUnit(currentUser.getId(), a.getOrgUnit().getId())))
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
            
            if (targetOrgUnit != null) {
                int viewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), targetOrgUnit.getId());
                int viewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), targetOrgUnit.getId());

                // 1. Chỉ cấp Trưởng (Rank 0) mới có quyền thực hiện đánh giá cho người khác
                if (viewerRank > 0) {
                    throw new ForbiddenException("Chỉ cấp Trưởng mới có quyền thực hiện đánh giá cho nhân viên.");
                }

                // 2. Kiểm tra quan hệ cấp trên - cấp dưới
                boolean isSubordinate = evaluatedUserAssignments.stream().anyMatch(assignment -> {
                    Integer subLevel = assignment.getRole().getLevel();
                    Integer subRank = assignment.getRole().getRank();
                    
                    if (subLevel == null || subRank == null) return false;
                    
                    // Cấp dưới là người có Level thấp hơn (số lớn hơn) 
                    // HOẶC cùng Level nhưng có Rank thấp hơn (số lớn hơn)
                    return (subLevel > viewerLevel || (subLevel == viewerLevel && subRank > viewerRank));
                });

                if (!isSubordinate) {
                    throw new ForbiddenException("Bạn chỉ có quyền đánh giá nhân viên cấp dưới trong sơ đồ tổ chức.");
                }
            }
        }

        // Check if an evaluation already exists for this user, period, and evaluator
        // If it exists, update it instead of creating a new one
        Evaluation evaluation = evaluationRepository.findByUserIdAndKpiPeriodIdAndEvaluatorId(
                evaluatedUser.getId(), kpiPeriod.getId(), currentUser.getId())
                .orElse(new Evaluation());

        evaluation.setUser(evaluatedUser);
        evaluation.setEvaluator(currentUser);
        evaluation.setKpiPeriod(kpiPeriod);
        evaluation.setOrgUnit(targetOrgUnit);
        evaluation.setScore(request.getScore());
        evaluation.setComment(request.getComment());
        evaluation.setSystemScore(calculateSystemScore(evaluatedUser.getId(), kpiPeriod.getId(), (double) org.getEvaluationMaxScore()));

        // Performance-matrix rating (only when qualitative KPIs are enabled & scored)
        Double completion = calculateKpiCompletionPercent(evaluatedUser.getId(), kpiPeriod.getId());
        Double behavior = Boolean.TRUE.equals(org.getEnableQualitative())
                ? calculateBehaviorScore(evaluatedUser.getId(), kpiPeriod.getId()) : null;
        // No quantitative KPI -> completion axis N/A, treat as on-target (100%) for the matrix.
        double colCompletion = completion != null ? completion : 100.0;
        evaluation.setKpiCompletionPercent(completion);
        evaluation.setBehaviorScore(behavior);
        evaluation.setMatrixRating(behavior != null ? lookupMatrixRating(behavior, colCompletion, org.getPerformanceMatrix()) : null);

        evaluation.setPeriodStart(kpiPeriod.getStartDate());
        evaluation.setPeriodEnd(kpiPeriod.getEndDate());

        evaluation = evaluationRepository.save(evaluation);
        return enrichResponse(evaluation);
    }

    @Transactional(readOnly = true)
    public Double getSystemScore(UUID kpiPeriodId, UUID userId) {
        User currentUser = getCurrentUser();
        UUID targetUserId = userId != null ? userId : currentUser.getId();

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(kpiPeriodId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", kpiPeriodId));

        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> evaluatedUserAssignments = userRoleOrgUnitRepository.findByUserId(targetUserId);
        if (evaluatedUserAssignments.isEmpty()) {
            return 0.0;
        }
        OrgUnit targetOrgUnit = evaluatedUserAssignments.get(0).getOrgUnit();
        com.kpitracking.entity.Organization org = targetOrgUnit.getOrgHierarchyLevel().getOrganization();

        return calculateSystemScore(targetUserId, kpiPeriodId, (double) org.getEvaluationMaxScore());
    }

    @Transactional(readOnly = true)
    public com.kpitracking.dto.response.evaluation.EvaluationScorePreview getScorePreview(UUID kpiPeriodId, UUID userId) {
        User currentUser = getCurrentUser();
        UUID targetUserId = userId != null ? userId : currentUser.getId();

        kpiPeriodRepository.findById(kpiPeriodId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", kpiPeriodId));

        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(targetUserId);
        if (assignments.isEmpty()) {
            return com.kpitracking.dto.response.evaluation.EvaluationScorePreview.builder()
                    .systemScore(0.0).kpiCompletionPercent(0.0).build();
        }
        com.kpitracking.entity.Organization org = assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization();

        Double completion = calculateKpiCompletionPercent(targetUserId, kpiPeriodId);
        Double behavior = Boolean.TRUE.equals(org.getEnableQualitative())
                ? calculateBehaviorScore(targetUserId, kpiPeriodId) : null;
        // No quantitative KPI -> completion axis N/A, treat as on-target (100%) for the matrix.
        double colCompletion = completion != null ? completion : 100.0;
        Integer rating = behavior != null ? lookupMatrixRating(behavior, colCompletion, org.getPerformanceMatrix()) : null;

        return com.kpitracking.dto.response.evaluation.EvaluationScorePreview.builder()
                .systemScore(calculateSystemScore(targetUserId, kpiPeriodId, (double) org.getEvaluationMaxScore()))
                .behaviorScore(behavior)
                .kpiCompletionPercent(completion)
                .matrixRating(rating)
                .build();
    }

    private Double calculateSystemScore(UUID userId, UUID kpiPeriodId, Double maxScore) {
        // system_score (0..100) is QUANTITATIVE-ONLY, normalized over the non-bonus
        // quantitative weight pool so it still reaches maxScore at full completion even
        // when part of the 100% pool is taken by qualitative KPIs (which feed the matrix).
        double[] p = quantitativeParts(userId, kpiPeriodId); // [0]=Σ(ratio·weight) non-bonus, [1]=Σweight non-bonus, [2]=Σ(ratio·weight) bonus
        double regular = p[1] > 0 ? (p[0] / p[1]) * maxScore : 0.0;
        double bonus = p[2] * (maxScore / 100.0);
        return Math.min(maxScore, (double) Math.round(regular)) + (double) Math.round(bonus);
    }

    /**
     * Aggregates the quantitative KPIs of a user in a period.
     * Returns [Σ(ratio·weight) non-bonus, Σweight non-bonus, Σ(ratio·weight) bonus].
     */
    private double[] quantitativeParts(UUID userId, UUID kpiPeriodId) {
        List<KpiStatus> activeKpiStatuses = Arrays.asList(
                KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                userId, kpiPeriodId, activeKpiStatuses, Pageable.unpaged()).getContent();
        double[] parts = new double[3];
        if (kpis.isEmpty()) return parts;

        boolean enableWaterfall = kpis.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getEnableWaterfall();
        for (KpiCriteria kpi : kpis) {
            if (kpi.getStatus() == KpiStatus.INACTIVE && kpi.getCompensatedAchievementPercent() == null) continue;
            boolean isDecompositionParent = kpi.getChildren() != null && kpi.getChildren().stream()
                    .anyMatch(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION);
            if (isDecompositionParent) continue;
            // Qualitative KPIs feed the performance matrix, not the 0..100 score.
            if (kpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE) continue;

            if (kpi.getTargetValue() != null && kpi.getTargetValue() > 0 && kpi.getWeight() != null) {
                double ratio;
                if (kpi.getCompensatedAchievementPercent() != null) {
                    ratio = kpi.getCompensatedAchievementPercent() / 100.0;
                } else {
                    double actual = calculateKpiActualValue(kpi, userId, enableWaterfall);
                    boolean isInverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
                    ratio = isInverse ? Math.max(0.0, 2.0 - (actual / kpi.getTargetValue())) : actual / kpi.getTargetValue();
                }
                ratio = Math.min(ratio, 1.5);
                double weight = kpi.getWeight();
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) {
                    parts[2] += ratio * weight;
                } else {
                    parts[0] += ratio * weight;
                    parts[1] += weight;
                }
            }
        }
        return parts;
    }

    /**
     * Overall quantitative completion % (matrix COLUMN axis).
     * Returns null when the user has no quantitative KPI (completion is N/A, not 0%).
     */
    private Double calculateKpiCompletionPercent(UUID userId, UUID kpiPeriodId) {
        double[] p = quantitativeParts(userId, kpiPeriodId);
        return p[1] > 0 ? (p[0] / p[1]) * 100.0 : null;
    }

    /**
     * Weighted-average qualitative level value 0..5 (matrix ROW axis).
     * Uses each qualitative KPI's latest APPROVED submission's chosen level.
     * Returns null when there is no scored qualitative KPI.
     */
    private Double calculateBehaviorScore(UUID userId, UUID kpiPeriodId) {
        List<KpiStatus> activeKpiStatuses = Arrays.asList(
                KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                userId, kpiPeriodId, activeKpiStatuses, Pageable.unpaged()).getContent();
        double weightedSum = 0.0, totalWeight = 0.0;
        for (KpiCriteria kpi : kpis) {
            if (kpi.getKpiType() != com.kpitracking.enums.KpiType.QUALITATIVE) continue;
            if (kpi.getStatus() == KpiStatus.INACTIVE && kpi.getCompensatedAchievementPercent() == null) continue;
            double weight = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
            if (weight <= 0) continue;
            // Include PENDING so the behavior score (and matrix rating) can be previewed at
            // self-evaluation time, before the manager approves the qualitative submission.
            Double levelValue = kpi.getSubmissions().stream()
                    .filter(s -> s.getDeletedAt() == null
                            && s.getSubmittedBy().getId().equals(userId)
                            && (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING)
                            && s.getQualitativeLevel() != null
                            && s.getQualitativeLevel().getValue() != null)
                    .max(java.util.Comparator.comparing(com.kpitracking.entity.KpiSubmission::getCreatedAt,
                            java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                    .map(s -> s.getQualitativeLevel().getValue())
                    .orElse(null);
            if (levelValue == null) continue;
            weightedSum += levelValue * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : null;
    }

    /** Looks up the org's performance_matrix: (behaviorScore rows) × (completion% cols) -> rating 1..5. */
    private Integer lookupMatrixRating(Double behaviorScore, Double completionPercent, String matrixJson) {
        if (behaviorScore == null || completionPercent == null || matrixJson == null || matrixJson.isBlank()) return null;
        try {
            com.fasterxml.jackson.databind.JsonNode root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(matrixJson);
            com.fasterxml.jackson.databind.JsonNode rows = root.get("rows");
            com.fasterxml.jackson.databind.JsonNode cols = root.get("cols");
            com.fasterxml.jackson.databind.JsonNode cells = root.get("cells");
            if (rows == null || cols == null || cells == null) return null;
            int rowIdx = bandIndex(behaviorScore, rows);
            int colIdx = bandIndex(completionPercent, cols);
            if (rowIdx < 0 || colIdx < 0 || rowIdx >= cells.size()) return null;
            com.fasterxml.jackson.databind.JsonNode rowCells = cells.get(rowIdx);
            if (rowCells == null || colIdx >= rowCells.size()) return null;
            return rowCells.get(colIdx).asInt();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Finds the band index for a value given ascending band labels (e.g. "<2", "≥2 và <3", "≥120%").
     * Uses the largest number in each label as its upper bound; the last band is treated as +∞.
     */
    private int bandIndex(double value, com.fasterxml.jackson.databind.JsonNode bands) {
        java.util.regex.Pattern num = java.util.regex.Pattern.compile("[0-9]+(?:\\.[0-9]+)?");
        for (int i = 0; i < bands.size(); i++) {
            if (i == bands.size() - 1) return i; // last band catches everything remaining
            java.util.regex.Matcher m = num.matcher(bands.get(i).asText());
            double upper = Double.NEGATIVE_INFINITY;
            while (m.find()) upper = Math.max(upper, Double.parseDouble(m.group()));
            if (upper == Double.NEGATIVE_INFINITY) continue;
            if (value < upper) return i;
        }
        return bands.size() - 1;
    }

    private double calculateKpiActualValue(KpiCriteria kpi, UUID targetUserId, boolean enableWaterfall) {
        // Waterfall logic: If enabled and has children, calculate AVERAGE of their values
        if (enableWaterfall) {
            List<KpiCriteria> children = kpiCriteriaRepository.findByParentId(kpi.getId());
            if (!children.isEmpty()) {
                // When flowing up, we want the AVERAGE value of child KPIs
                return children.stream()
                        .mapToDouble(child -> calculateKpiActualValue(child, null, true))
                        .average()
                        .orElse(0.0);
            }
        }

        // Base case: Sum submissions for this specific KPI
        // If targetUserId is provided, we only count their personal contribution (Personal Evaluation)
        // If targetUserId is null, we count everyone (Unit performance flowing up in Waterfall)
        return kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null && 
                        (targetUserId == null || s.getSubmittedBy().getId().equals(targetUserId)) &&
                        (s.getStatus() == SubmissionStatus.APPROVED || 
                         s.getStatus() == SubmissionStatus.PENDING || 
                         s.getStatus() == SubmissionStatus.REJECTED))
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();
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

        // Matrix result fields (set explicitly so they don't depend on mapper regeneration)
        response.setBehaviorScore(evaluation.getBehaviorScore());
        response.setKpiCompletionPercent(evaluation.getKpiCompletionPercent());
        response.setMatrixRating(evaluation.getMatrixRating());

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
                    Integer roleLevel = r.getLevel();
                    Integer roleRank = r.getRank();
                    response.setEvaluatorRoleLevel(roleLevel);
                    response.setOrgUnitLevel(evaluation.getOrgUnit().getOrgHierarchyLevel().getLevelOrder());

                    if (roleLevel != null) {
                        if (roleLevel == 0) {
                            response.setEvaluatorRole("CEO");
                        } else if (roleLevel == 1) {
                            response.setEvaluatorRole("REGIONAL_DIRECTOR");
                        } else if (roleLevel == 2) {
                            response.setEvaluatorRole("DIRECTOR"); 
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
                    response.setEvaluatorRoleName(r.getName());
                } else {
                    response.setEvaluatorRole("MANAGER");
                }
            }
        }
        
        return response;
    }
}
