package com.kpitracking.service;

import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Đánh giá theo KỲ (rollup trên đánh giá đợt sẵn có):
 * - Điểm kỳ của 1 người = trung bình điểm các đợt trong kỳ (2 phía self/QLTT).
 * - Điểm phòng ban = gộp trung bình điểm kỳ của các thành viên.
 * - Chế độ định lượng/định tính/cả 2 chỉ chọn chiều điểm nào để lấy trung bình.
 */
@Service
@RequiredArgsConstructor
public class KpiCycleEvaluationService {

    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final EvaluationRepository evaluationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final CycleUnitEvaluationRepository cycleUnitEvaluationRepository;
    private final CycleUserEvaluationRepository cycleUserEvaluationRepository;
    private final EvaluationService evaluationService;
    private final com.kpitracking.security.PermissionChecker permissionChecker;

    // ─────────────────────────────── Per-user ───────────────────────────────

    @Transactional(readOnly = true)
    public CycleUserEvaluationResponse getUserCycleEvaluation(UUID cycleId, UUID userId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));
        double maxScore = maxScore(cycle);
        return computeUser(cycle, user, maxScore, finalizedUnits(cycle.getId()));
    }

    private CycleUserEvaluationResponse computeUser(KpiCycle cycle, User user, double maxScore,
                                                    List<CycleUnitEvaluation> finalizedUnits) {
        CycleEvaluationMode mode = cycle.getEvaluationMode() != null ? cycle.getEvaluationMode() : CycleEvaluationMode.BOTH;
        List<KpiPeriod> periods = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId());

        List<CycleUserEvaluationResponse.PeriodBreakdown> breakdown = new ArrayList<>();
        double selfSum = 0; int selfN = 0;
        double mgrSum = 0; int mgrN = 0;

        for (KpiPeriod p : periods) {
            Evaluation selfEval = selfEvaluation(user.getId(), p.getId());
            Evaluation mgrEval = managerEvaluation(user.getId(), p.getId());

            Double selfScore = pickDimension(selfEval, mode, maxScore);
            Double mgrScore = pickDimension(mgrEval, mode, maxScore);
            if (selfScore != null) { selfSum += selfScore; selfN++; }
            if (mgrScore != null) { mgrSum += mgrScore; mgrN++; }

            // Hai chiều thuần để nhìn rõ ở chế độ "Cả hai" (system_score / behavior_score
            // là số do hệ thống tính, không phụ thuộc người đánh giá).
            Evaluation ref = mgrEval != null ? mgrEval : selfEval;

            breakdown.add(CycleUserEvaluationResponse.PeriodBreakdown.builder()
                    .periodId(p.getId()).periodName(p.getName())
                    .selfScore(round(selfScore)).managerScore(round(mgrScore))
                    .quantScore(ref != null ? round(ref.getSystemScore()) : null)
                    .qualScore(ref != null ? round(ref.getBehaviorScore()) : null)
                    // Xếp loại ma trận (1..5) — chỉ có khi đủ cả 2 trục và tổ chức đã cấu hình ma trận.
                    .matrixRating(ref != null ? ref.getMatrixRating() : null)
                    .completionPercent(ref != null ? round(ref.getKpiCompletionPercent()) : null)
                    .build());
        }

        // Trục cột của ma trận ở cấp kỳ = TB % hoàn thành định lượng các đợt có dữ liệu.
        // Kỳ không có KPI định lượng nào ⇒ mặc định 100% (giống cách đánh giá theo đợt xử lý).
        double cpSum = 0; int cpN = 0;
        for (CycleUserEvaluationResponse.PeriodBreakdown b : breakdown) {
            if (b.getCompletionPercent() != null) { cpSum += b.getCompletionPercent(); cpN++; }
        }
        Double avgCompletionPercent = cpN > 0 ? round(cpSum / cpN) : 100.0;

        OrgUnit unit = primaryUnit(user.getId());
        Double managerScore = mgrN > 0 ? round(mgrSum / mgrN) : null;

        // Điểm chốt kỳ: ưu tiên giá trị đã nhập tay, mặc định = TB điểm QLTT các đợt.
        CycleUserEvaluation saved = cycleUserEvaluationRepository
                .findByKpiCycleIdAndUserId(cycle.getId(), user.getId()).orElse(null);
        boolean overridden = saved != null && saved.getFinalScore() != null;

        // Khoá được kế thừa xuống dưới: đơn vị của nhân viên hoặc bất kỳ đơn vị cha nào đã chốt.
        OrgUnit lockingUnit = lockingUnit(unit, finalizedUnits);

        return CycleUserEvaluationResponse.builder()
                .userId(user.getId())
                .userName(user.getFullName())
                .orgUnitId(unit != null ? unit.getId() : null)
                .orgUnitName(unit != null ? unit.getName() : null)
                .mode(mode)
                .selfScore(selfN > 0 ? round(selfSum / selfN) : null)
                .managerScore(managerScore)
                .finalScore(overridden ? round(saved.getFinalScore()) : managerScore)
                .finalScoreOverridden(overridden)
                .qualScore(saved != null ? saved.getQualScore() : null)
                .matrixRating(saved != null ? saved.getMatrixRating() : null)
                .avgCompletionPercent(avgCompletionPercent)
                .comment(saved != null ? saved.getComment() : null)
                .evaluatedByName(saved != null && saved.getEvaluatedBy() != null ? saved.getEvaluatedBy().getFullName() : null)
                .evaluatedAt(saved != null ? saved.getEvaluatedAt() : null)
                .locked(lockingUnit != null)
                .lockedByUnitName(lockingUnit != null ? lockingUnit.getName() : null)
                .periodBreakdown(breakdown)
                .build();
    }

    /** Lưu điểm chốt kỳ (nhập tay) cho một nhân viên. */
    @Transactional
    public CycleUserEvaluationResponse saveUserCycleScore(UUID cycleId, UUID userId, Double finalScore,
                                                          Double qualScore, String comment) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));

        // Chỉ được chấm nhân viên thuộc phạm vi đơn vị mình quản lý.
        OrgUnit userUnit = primaryUnit(user.getId());
        if (userUnit != null) assertCanManageUnit(userUnit.getId());

        // Phòng ban chứa nhân viên đã chốt ⇒ khoá, chỉ được xem.
        OrgUnit locking = lockingUnit(userUnit, finalizedUnits(cycleId));
        if (locking != null) {
            throw new IllegalArgumentException("Đánh giá kỳ của đơn vị \"" + locking.getName()
                    + "\" đã được chốt, không thể chỉnh điểm. Hãy mở khoá ở đơn vị đó trước khi sửa.");
        }

        double maxScore = maxScore(cycle);
        if (finalScore != null && (finalScore < 0 || finalScore > maxScore)) {
            throw new IllegalArgumentException("Điểm chốt kỳ phải nằm trong khoảng 0 đến " + maxScore);
        }

        CycleUserEvaluation entity = cycleUserEvaluationRepository
                .findByKpiCycleIdAndUserId(cycleId, userId)
                .orElseGet(() -> CycleUserEvaluation.builder().kpiCycle(cycle).user(user).build());

        if (qualScore != null && (qualScore < 0 || qualScore > 5)) {
            throw new IllegalArgumentException("Mức định tính phải nằm trong khoảng 0 đến 5");
        }

        CycleEvaluationMode mode = cycle.getEvaluationMode() != null
                ? cycle.getEvaluationMode() : CycleEvaluationMode.BOTH;

        // Chế độ Định lượng: không có trục định tính ⇒ bỏ qua điểm định tính và ma trận.
        if (mode == CycleEvaluationMode.QUANTITATIVE) {
            qualScore = null;
        }
        // Chế độ Định tính: điểm chốt suy ra từ mức định tính (0..5 → 0..maxScore),
        // không nhận điểm định lượng nhập tay.
        if (mode == CycleEvaluationMode.QUALITATIVE) {
            finalScore = qualScore != null ? round(qualScore / 5.0 * maxScore) : null;
        }

        // Tra ma trận hiệu suất của tổ chức: (mức định tính) × (TB % hoàn thành định lượng).
        // Dùng lại đúng hàm mà đánh giá theo đợt đang dùng. Chỉ có nghĩa khi có trục định tính.
        Integer matrixRating = null;
        if (qualScore != null) {
            Double avgCompletion = computeUser(cycle, user, maxScore, finalizedUnits(cycleId))
                    .getAvgCompletionPercent();
            String matrixJson = cycle.getOrganization() != null
                    ? cycle.getOrganization().getPerformanceMatrix() : null;
            matrixRating = evaluationService.lookupMatrixRating(qualScore, avgCompletion, matrixJson);
        }

        entity.setFinalScore(finalScore);
        entity.setQualScore(qualScore);
        entity.setMatrixRating(matrixRating);
        entity.setComment(comment);
        entity.setEvaluatedBy(getCurrentUser());
        entity.setEvaluatedAt(Instant.now());
        cycleUserEvaluationRepository.save(entity);

        return computeUser(cycle, user, maxScore, finalizedUnits(cycleId));
    }

    // ─────────────────────────────── Per-unit ───────────────────────────────

    /**
     * Tổng hợp phòng ban: tính LIVE từ thành viên, nhưng nếu đã CHỐT thì các con số
     * lấy từ snapshot lúc chốt để không bị trôi khi ai đó sửa đánh giá đợt cũ.
     */
    @Transactional(readOnly = true)
    public CycleUnitEvaluationResponse getUnitCycleSummary(UUID cycleId, UUID orgUnitId) {
        CycleUnitEvaluationResponse live = computeUnitSummary(cycleId, orgUnitId);

        CycleUnitEvaluation saved = cycleUnitEvaluationRepository
                .findByKpiCycleIdAndOrgUnitId(cycleId, orgUnitId).orElse(null);
        if (saved == null) return live;

        live.setStatus(saved.getStatus());
        live.setComment(saved.getComment());
        live.setFinalizedByName(saved.getFinalizedBy() != null ? saved.getFinalizedBy().getFullName() : null);
        live.setFinalizedAt(saved.getFinalizedAt());

        if (saved.getStatus() == CycleUnitEvalStatus.FINALIZED) {
            live.setSelfScore(saved.getSelfScore());
            live.setManagerScore(saved.getManagerScore());
            live.setQualScore(saved.getQualScore());
            live.setMatrixRating(saved.getMatrixRating());
            live.setMemberCount(saved.getMemberCount() != null ? saved.getMemberCount() : live.getMemberCount());
            live.setFromSnapshot(true);
        }
        return live;
    }

    /** Tính tổng hợp phòng ban trực tiếp từ thành viên (bỏ qua snapshot). */
    private CycleUnitEvaluationResponse computeUnitSummary(UUID cycleId, UUID orgUnitId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        double maxScore = maxScore(cycle);
        CycleEvaluationMode mode = cycle.getEvaluationMode() != null ? cycle.getEvaluationMode() : CycleEvaluationMode.BOTH;

        List<CycleUserEvaluationResponse> members = new ArrayList<>();
        double selfSum = 0; int selfN = 0;
        double mgrSum = 0; int mgrN = 0;
        double qualSum = 0; int qualN = 0;
        double matrixSum = 0; int matrixN = 0;
        List<CycleUnitEvaluation> finalizedUnits = finalizedUnits(cycle.getId());
        // Điểm phòng ban gộp từ ĐIỂM CHỐT của từng nhân viên (đã tính cả phần chỉnh tay).
        for (User u : subtreeMembers(unit)) {
            CycleUserEvaluationResponse m = computeUser(cycle, u, maxScore, finalizedUnits);
            members.add(m);
            if (m.getSelfScore() != null) { selfSum += m.getSelfScore(); selfN++; }
            if (m.getFinalScore() != null) { mgrSum += m.getFinalScore(); mgrN++; }
            if (m.getQualScore() != null) { qualSum += m.getQualScore(); qualN++; }
            if (m.getMatrixRating() != null) { matrixSum += m.getMatrixRating(); matrixN++; }
        }

        return CycleUnitEvaluationResponse.builder()
                .cycleId(cycle.getId()).cycleName(cycle.getName())
                .orgUnitId(unit.getId()).orgUnitName(unit.getName())
                .mode(mode)
                .selfScore(selfN > 0 ? round(selfSum / selfN) : null)
                .managerScore(mgrN > 0 ? round(mgrSum / mgrN) : null)
                .qualScore(qualN > 0 ? round(qualSum / qualN) : null)
                .matrixRating(matrixN > 0 ? round(matrixSum / matrixN) : null)
                .memberCount(members.size())
                .status(CycleUnitEvalStatus.DRAFT)
                .members(members)
                .build();
    }

    @Transactional
    public CycleUnitEvaluationResponse finalizeUnitCycle(UUID cycleId, UUID orgUnitId, String comment) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        assertCanManageUnit(orgUnitId);

        // Luôn TÍNH LẠI từ thành viên khi chốt (kể cả chốt lại), không lấy snapshot cũ.
        CycleUnitEvaluationResponse summary = computeUnitSummary(cycleId, orgUnitId);

        CycleUnitEvaluation entity = cycleUnitEvaluationRepository
                .findByKpiCycleIdAndOrgUnitId(cycleId, orgUnitId)
                .orElseGet(() -> CycleUnitEvaluation.builder().kpiCycle(cycle).orgUnit(unit).build());

        entity.setEvaluationMode(summary.getMode());
        entity.setSelfScore(summary.getSelfScore());
        entity.setManagerScore(summary.getManagerScore());
        entity.setQualScore(summary.getQualScore());
        entity.setMatrixRating(summary.getMatrixRating());
        entity.setMemberCount(summary.getMemberCount());
        entity.setComment(comment);
        entity.setStatus(CycleUnitEvalStatus.FINALIZED);
        entity.setFinalizedBy(getCurrentUser());
        entity.setFinalizedAt(Instant.now());
        cycleUnitEvaluationRepository.save(entity);

        return getUnitCycleSummary(cycleId, orgUnitId);
    }

    /** Mở khoá (đưa về DRAFT) để chỉnh lại điểm sau khi đã chốt. */
    @Transactional
    public CycleUnitEvaluationResponse reopenUnitCycle(UUID cycleId, UUID orgUnitId) {
        assertCanManageUnit(orgUnitId);
        CycleUnitEvaluation entity = cycleUnitEvaluationRepository
                .findByKpiCycleIdAndOrgUnitId(cycleId, orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đánh giá kỳ của phòng ban", "orgUnitId", orgUnitId));

        entity.setStatus(CycleUnitEvalStatus.DRAFT);
        entity.setFinalizedBy(null);
        entity.setFinalizedAt(null);
        cycleUnitEvaluationRepository.save(entity);

        return getUnitCycleSummary(cycleId, orgUnitId);
    }

    /**
     * Chỉ người được gán ở CHÍNH đơn vị đó hoặc đơn vị CHA mới được chốt/mở khoá.
     * Nhờ vậy cấp dưới không thể tự gỡ khoá do cấp trên đặt.
     */
    private void assertCanManageUnit(UUID orgUnitId) {
        User current = getCurrentUser();
        if (!permissionChecker.hasPermissionInOrgUnit(current.getId(), "CYCLE_EVAL:FINALIZE", orgUnitId)) {
            throw new com.kpitracking.exception.ForbiddenException(
                    "Bạn không có quyền chốt hoặc mở khoá đánh giá kỳ của đơn vị này");
        }
    }

    /** Các bản tổng hợp phòng ban ĐÃ CHỐT của kỳ (nạp 1 lần cho cả request). */
    private List<CycleUnitEvaluation> finalizedUnits(UUID cycleId) {
        return cycleUnitEvaluationRepository.findByKpiCycleId(cycleId).stream()
                .filter(e -> e.getStatus() == CycleUnitEvalStatus.FINALIZED)
                .toList();
    }

    /**
     * Đơn vị đã chốt đang khoá nhân viên thuộc {@code userUnit} (null nếu không bị khoá).
     * Khoá kế thừa xuống dưới: OrgUnit dùng materialized path nên đơn vị con
     * có path bắt đầu bằng path của cha — chốt ở cha thì con cũng bị khoá.
     */
    private OrgUnit lockingUnit(OrgUnit userUnit, List<CycleUnitEvaluation> finalizedUnits) {
        if (userUnit == null || userUnit.getPath() == null) return null;
        for (CycleUnitEvaluation e : finalizedUnits) {
            OrgUnit unit = e.getOrgUnit();
            if (unit != null && unit.getPath() != null && userUnit.getPath().startsWith(unit.getPath())) {
                return unit;
            }
        }
        return null;
    }

    // ─────────────────────────────── Helpers ───────────────────────────────

    /** Điểm theo chiều được chọn, quy về thang 0..maxScore. Null nếu chưa có dữ liệu. */
    private Double pickDimension(Evaluation e, CycleEvaluationMode mode, double maxScore) {
        if (e == null) return null;
        switch (mode) {
            case QUANTITATIVE:
                return e.getSystemScore();
            case QUALITATIVE:
                // behaviorScore thang 0..5 → quy về 0..maxScore cho đồng nhất hiển thị.
                return e.getBehaviorScore() != null ? e.getBehaviorScore() / 5.0 * maxScore : null;
            case BOTH:
            default:
                return e.getScore();
        }
    }

    /** Bản tự đánh giá của user trong 1 đợt (evaluator == user). */
    private Evaluation selfEvaluation(UUID userId, UUID periodId) {
        for (Evaluation e : evaluationRepository.findByUserIdAndKpiPeriodId(userId, periodId)) {
            if (e.getEvaluator() != null && e.getEvaluator().getId().equals(userId)) return e;
        }
        return null;
    }

    /** Bản đánh giá đại diện của QLTT (loại self). */
    private Evaluation managerEvaluation(UUID userId, UUID periodId) {
        Evaluation eff = evaluationService.getEffectiveEvaluation(userId, periodId);
        if (eff != null && eff.getEvaluator() != null && eff.getEvaluator().getId().equals(userId)) return null;
        return eff;
    }

    private List<User> subtreeMembers(OrgUnit unit) {
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath(), orgId);
        List<UUID> unitIds = subtree.isEmpty() ? List.of(unit.getId())
                : subtree.stream().map(OrgUnit::getId).toList();
        Map<UUID, User> distinct = new LinkedHashMap<>();
        for (UserRoleOrgUnit uro : userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds)) {
            if (uro.getUser() != null) distinct.putIfAbsent(uro.getUser().getId(), uro.getUser());
        }
        return new ArrayList<>(distinct.values());
    }

    private OrgUnit primaryUnit(UUID userId) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(userId);
        return roles.isEmpty() ? null : roles.get(0).getOrgUnit();
    }

    private double maxScore(KpiCycle cycle) {
        Double max = cycle.getOrganization() != null ? cycle.getOrganization().getEvaluationMaxScore() : null;
        return max != null ? max : 100.0;
    }

    private Double round(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }
}
