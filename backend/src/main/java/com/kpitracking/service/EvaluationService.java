package com.kpitracking.service;

import com.kpitracking.dto.request.evaluation.CreateEvaluationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
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
    private final KpiAchievementCalculator achievementCalculator;
    private final BscScoringService bscScoringService;

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

        // BSC: luôn tính & lưu bsc_score + breakdown khi org bật BSC (kể cả SHADOW).
        // system_score CŨ giữ nguyên — bsc_score chỉ được coi là điểm chính thức khi scorecard ở OFFICIAL
        // (quyết định lúc đọc, xem resolveOfficialScore) nên đổi mode KHÔNG cần tính lại.
        // Org không bật BSC: bỏ qua hoàn toàn, luồng cũ không đổi.
        if (Boolean.TRUE.equals(org.getEnableBsc())) {
            var bscResult = bscScoringService.computeForUser(
                    evaluatedUser.getId(), kpiPeriod.getId(), org.getId(),
                    Boolean.TRUE.equals(org.getEnableWaterfall()));
            boolean isOfficial = bscResult != null
                    && bscScoringService.getScoringMode(org.getId(), kpiPeriod.getId()) == com.kpitracking.enums.BscScoringMode.OFFICIAL;

            // Khi kỳ đã chạy CHÍNH THỨC, bsc_score là điểm thật ⇒ dữ liệu phải đủ:
            // còn KPI chưa gán viễn cảnh thì chặn chốt điểm. Ở SHADOW chỉ cảnh báo (preview), không chặn.
            if (isOfficial && bscResult.getUnassignedKpiCount() > 0) {
                throw new BusinessException("Không thể chốt đánh giá: còn "
                        + bscResult.getUnassignedKpiCount() + " chỉ tiêu chưa gán viễn cảnh BSC ("
                        + String.join(", ", bscResult.getUnassignedKpiNames()) + ")");
            }

            // CHÍNH THỨC ⇒ điểm bị KHÓA theo bsc_score: bỏ qua điểm người đánh giá gửi lên.
            // Ép ở server (không chỉ khóa UI) để gọi thẳng API cũng không sửa được điểm.
            if (isOfficial && bscResult.getBscScore() != null) {
                evaluation.setScore(bscResult.getBscScore());
            }

            evaluation.setBscScore(bscResult != null ? bscResult.getBscScore() : null);
            bscScoringService.persistBreakdown(evaluation, bscResult);
            evaluation = evaluationRepository.save(evaluation);
        }

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

        Double systemScore = calculateSystemScore(targetUserId, kpiPeriodId, (double) org.getEvaluationMaxScore());

        var builder = com.kpitracking.dto.response.evaluation.EvaluationScorePreview.builder()
                .systemScore(systemScore)
                .behaviorScore(behavior)
                .kpiCompletionPercent(completion)
                .matrixRating(rating)
                .officialScore(systemScore);

        // BSC preview (chỉ khi org bật BSC & kỳ đã có thẻ điểm)
        if (Boolean.TRUE.equals(org.getEnableBsc())) {
            var bsc = bscScoringService.computeForUser(targetUserId, kpiPeriodId, org.getId(),
                    Boolean.TRUE.equals(org.getEnableWaterfall()));
            if (bsc != null) {
                var mode = bscScoringService.getScoringMode(org.getId(), kpiPeriodId);
                builder.bscScore(bsc.getBscScore())
                        .bscScoringMode(mode)
                        .bscPerspectives(bsc.getPerspectives())
                        .bscCoveragePercent(bsc.getCoveragePercent())
                        .bscUnassignedKpis(bsc.getUnassignedKpiNames())
                        .officialScore(bscScoringService.resolveOfficialScore(systemScore, bsc.getBscScore(), mode));
            }
        }

        return builder.build();
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
            // Quy tắc loại trừ + công thức tỉ lệ đạt nằm ở KpiAchievementCalculator (dùng chung với BSC).
            if (!achievementCalculator.countsTowardQuantitativeScore(kpi)) continue;

            double ratio = achievementCalculator.ratio(kpi, userId, enableWaterfall);
            double weight = kpi.getWeight();
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) {
                parts[2] += ratio * weight;
            } else {
                parts[0] += ratio * weight;
                parts[1] += weight;
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

    /** Looks up the org's performance_matrix: (behaviorScore rows) × (completion% cols) -> rating 1..5.
     *  Logic dải tách về {@link com.kpitracking.util.PerformanceMatrixResolver} để dùng chung với thống kê. */
    private Integer lookupMatrixRating(Double behaviorScore, Double completionPercent, String matrixJson) {
        return com.kpitracking.util.PerformanceMatrixResolver.rating(matrixJson, behaviorScore, completionPercent);
    }

    // ── Hiệu suất theo ĐÁNH GIÁ của người trong đợt (dùng cho thống kê/AI) ──────

    /** Khoá thâm niên của 1 user: NHỎ hơn = cao cấp hơn. = level*1000 + rank (lấy assignment tốt nhất). */
    private long seniorityKey(UUID userId) {
        List<UserRoleOrgUnit> uros = userRoleOrgUnitRepository.findByUserId(userId);
        int bestLevel = Integer.MAX_VALUE, bestRank = Integer.MAX_VALUE;
        for (UserRoleOrgUnit u : uros) {
            if (u.getRole() == null) continue;
            int l = u.getRole().getLevel() != null ? u.getRole().getLevel() : 99;
            int r = u.getRole().getRank() != null ? u.getRole().getRank() : 99;
            if (l < bestLevel || (l == bestLevel && r < bestRank)) { bestLevel = l; bestRank = r; }
        }
        if (bestLevel == Integer.MAX_VALUE) return Long.MAX_VALUE;
        return (long) bestLevel * 1000 + bestRank;
    }

    /** Công ty của user có bật thác nước không. */
    private boolean isWaterfallForUser(UUID userId) {
        List<UserRoleOrgUnit> uros = userRoleOrgUnitRepository.findByUserId(userId);
        for (UserRoleOrgUnit u : uros) {
            OrgUnit unit = u.getOrgUnit();
            if (unit != null && unit.getOrgHierarchyLevel() != null
                    && unit.getOrgHierarchyLevel().getOrganization() != null) {
                return Boolean.TRUE.equals(unit.getOrgHierarchyLevel().getOrganization().getEnableWaterfall());
            }
        }
        return false;
    }

    /**
     * Điểm hiệu suất (đánh giá) của 1 người trong 1 đợt, chọn bản đánh giá theo cấu hình thác nước:
     * - Không thác nước: lấy điểm của người đánh giá CAO CẤP nhất (gồm cả tự đánh giá).
     * - Có thác nước: chỉ lấy điểm của QUẢN LÝ TRỰC TIẾP (người cao hơn user và gần user nhất).
     * Trả {@code null} nếu không có đánh giá phù hợp.
     */
    @Transactional(readOnly = true)
    public Double getEffectivePerformanceScore(UUID userId, UUID kpiPeriodId) {
        Evaluation eff = getEffectiveEvaluation(userId, kpiPeriodId);
        if (eff == null) return null;
        // Org dùng performance matrix ⇒ hiệu suất = matrix_rating (ĐƠN VỊ "điểm", 1..max),
        // KHÔNG phải score (%). Chưa có matrix_rating → null (bỏ qua khi trung bình, giữ một thang duy nhất/org).
        com.kpitracking.entity.Organization org =
                eff.getOrgUnit() != null && eff.getOrgUnit().getOrgHierarchyLevel() != null
                        ? eff.getOrgUnit().getOrgHierarchyLevel().getOrganization() : null;
        if (org != null && Boolean.TRUE.equals(org.getEnableQualitative())) {
            return eff.getMatrixRating() != null ? eff.getMatrixRating().doubleValue() : null;
        }
        return eff.getScore();
    }

    /**
     * Bản đánh giá ĐẠI DIỆN của 1 người trong 1 đợt (theo cùng quy tắc thâm niên như
     * {@link #getEffectivePerformanceScore}). Trả {@code null} nếu không có đánh giá phù hợp.
     */
    @Transactional(readOnly = true)
    public Evaluation getEffectiveEvaluation(UUID userId, UUID kpiPeriodId) {
        if (userId == null || kpiPeriodId == null) return null;
        List<Evaluation> evals = evaluationRepository.findByUserIdAndKpiPeriodId(userId, kpiPeriodId);
        if (evals == null || evals.isEmpty()) return null;

        if (isWaterfallForUser(userId)) {
            long userKey = seniorityKey(userId);
            Evaluation direct = null;
            long directKey = Long.MIN_VALUE; // gần user nhất = key LỚN nhất nhưng vẫn < userKey
            for (Evaluation e : evals) {
                if (e.getEvaluator() == null || e.getEvaluator().getId().equals(userId)) continue; // bỏ self
                long k = seniorityKey(e.getEvaluator().getId());
                if (k < userKey && k > directKey) { directKey = k; direct = e; }
            }
            return direct;
        }

        Evaluation senior = null;
        long seniorKey = Long.MAX_VALUE; // cao cấp nhất = key NHỎ nhất
        for (Evaluation e : evals) {
            if (e.getEvaluator() == null) continue;
            long k = seniorityKey(e.getEvaluator().getId());
            if (k < seniorKey) { seniorKey = k; senior = e; }
        }
        return senior;
    }

    /**
     * Trung bình hiệu suất (đánh giá) trên tập (người × đợt); bỏ qua cặp chưa có đánh giá.
     * Null nếu không có điểm nào. Dùng cho thẻ tổng/AI: 1 người-nhiều đợt, nhiều người-1 đợt, v.v.
     */
    @Transactional(readOnly = true)
    public Double averagePerformance(java.util.Collection<UUID> userIds, java.util.Collection<UUID> periodIds) {
        if (userIds == null || userIds.isEmpty() || periodIds == null || periodIds.isEmpty()) return null;
        double sum = 0; int n = 0;
        for (UUID uid : new java.util.LinkedHashSet<>(userIds)) {
            for (UUID pid : new java.util.LinkedHashSet<>(periodIds)) {
                Double s = getEffectivePerformanceScore(uid, pid);
                if (s != null) { sum += s; n++; }
            }
        }
        return n > 0 ? sum / n : null;
    }

    // ── Hiệu suất ĐÁNH GIÁ cấp ĐƠN VỊ (subtree) — nguồn chung cho analytics, Insight, chatbot ──

    /** Id các đơn vị trong cây con của {@code unit} (gồm chính nó). */
    private List<UUID> subtreeUnitIds(OrgUnit unit) {
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath(), orgId);
        return subtree.isEmpty() ? List.of(unit.getId()) : subtree.stream().map(OrgUnit::getId).toList();
    }

    /**
     * Hiệu suất ĐÁNH GIÁ của 1 đơn vị (đã làm tròn):
     * - Không thác nước: trung bình đánh giá của MỌI người trong đơn vị (subtree).
     * - Có thác nước: đánh giá của (các) QUẢN LÝ đơn vị đó.
     * Tính trên {@code selectedPeriodIds}; nếu rỗng thì suy ra tất cả đợt mà KPI của đơn vị thuộc về.
     * Trả 0 nếu không có đánh giá phù hợp.
     */
    @Transactional(readOnly = true)
    public double unitEvaluationPerformance(OrgUnit unit, Collection<UUID> selectedPeriodIds) {
        List<UUID> subtreeIds = subtreeUnitIds(unit);
        Set<UUID> periodIds;
        if (selectedPeriodIds != null && !selectedPeriodIds.isEmpty()) {
            periodIds = new LinkedHashSet<>(selectedPeriodIds);
        } else {
            periodIds = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED).stream()
                    .map(KpiCriteria::getKpiPeriod).filter(Objects::nonNull)
                    .map(KpiPeriod::getId).collect(Collectors.toCollection(LinkedHashSet::new));
        }
        if (periodIds.isEmpty()) return 0;

        boolean waterfall = unit.getOrgHierarchyLevel() != null
                && unit.getOrgHierarchyLevel().getOrganization() != null
                && Boolean.TRUE.equals(unit.getOrgHierarchyLevel().getOrganization().getEnableWaterfall());

        Set<UUID> userIds = new LinkedHashSet<>();
        if (waterfall) {
            // Hiệu suất đơn vị = đánh giá của quản lý đơn vị.
            userRoleOrgUnitRepository.findManagersByOrgUnitId(unit.getId())
                    .forEach(uro -> userIds.add(uro.getUser().getId()));
        } else {
            // = TB đánh giá của tất cả nhân sự trong đơn vị (subtree).
            userRoleOrgUnitRepository.findByOrgUnitIdIn(subtreeIds)
                    .forEach(uro -> userIds.add(uro.getUser().getId()));
        }
        Double p = averagePerformance(userIds, periodIds);
        // Giữ 1 chữ số thập phân: thang "điểm" (1..5) cần chính xác (3.5 không được làm tròn thành 4).
        return p != null ? Math.round(p * 10.0) / 10.0 : 0;
    }

    /** Các đợt KPI của cây con {@code unit}, sắp theo ngày bắt đầu tăng dần (cho biểu đồ xu hướng). */
    @Transactional(readOnly = true)
    public List<KpiPeriod> subtreePeriodsOrdered(OrgUnit unit) {
        List<UUID> subtreeIds = subtreeUnitIds(unit);
        Map<UUID, KpiPeriod> byId = new LinkedHashMap<>();
        for (KpiCriteria k : kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED)) {
            KpiPeriod p = k.getKpiPeriod();
            if (p != null) byId.putIfAbsent(p.getId(), p);
        }
        return byId.values().stream()
                .sorted(Comparator.comparing(KpiPeriod::getStartDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
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

        // BSC: bsc_score đã lưu sẵn; officialScore chỉ là chọn field theo chế độ của kỳ (không tính lại).
        response.setBscScore(evaluation.getBscScore());
        if (evaluation.getBscScore() != null) {
            java.util.UUID orgId = evaluation.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
            var mode = bscScoringService.getScoringMode(orgId, evaluation.getKpiPeriod().getId());
            response.setBscScoringMode(mode);
            response.setBscPerspectives(bscScoringService.getBreakdown(evaluation.getId()));
            response.setOfficialScore(
                    bscScoringService.resolveOfficialScore(evaluation.getSystemScore(), evaluation.getBscScore(), mode));
        } else {
            response.setOfficialScore(evaluation.getSystemScore());
        }

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
