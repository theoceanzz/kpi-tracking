package com.kpitracking.service;

import com.kpitracking.dto.response.kpi.CycleApprovalStepResponse;
import com.kpitracking.dto.response.kpi.CycleUnitEvalEventResponse;
import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUnitStatusResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserRankResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.CycleUnitEvalAction;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.service.kpi.CycleEvaluationExcelWriter;
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
    private final CycleUnitEvalEventRepository cycleUnitEvalEventRepository;
    private final CycleUserEvaluationRepository cycleUserEvaluationRepository;
    private final EvaluationService evaluationService;
    private final UnitClassificationService unitClassificationService;
    private final ConductService conductService;
    private final com.kpitracking.service.kpi.CycleLockChecker cycleLockChecker;
    private final com.kpitracking.security.PermissionChecker permissionChecker;

    // ─────────────────────────────── Per-user ───────────────────────────────

    @Transactional(readOnly = true)
    public CycleUserEvaluationResponse getUserCycleEvaluation(UUID cycleId, UUID userId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));
        return computeUser(cycle, user, finalizedUnits(cycle.getId()));
    }

    private CycleUserEvaluationResponse computeUser(KpiCycle cycle, User user,
                                                    List<CycleUnitEvaluation> finalizedUnits) {
        CycleEvaluationMode mode = cycle.getEvaluationMode() != null ? cycle.getEvaluationMode() : CycleEvaluationMode.BOTH;
        List<KpiPeriod> periods = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId());

        List<CycleUserEvaluationResponse.PeriodBreakdown> breakdown = new ArrayList<>();
        double selfSum = 0; int selfN = 0;
        double mgrSum = 0; int mgrN = 0;

        for (KpiPeriod p : periods) {
            Evaluation selfEval = selfEvaluation(user.getId(), p.getId());
            Evaluation mgrEval = managerEvaluation(user.getId(), p.getId());

            Double selfScore = pickDimension(selfEval, mode);
            Double mgrScore = pickDimension(mgrEval, mode);
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
        // Kỳ không có KPI định lượng nào ⇒ TRỐNG (null), KHÔNG lấy 100% làm mặc định: một
        // loại KPI chỉ cấp được một trục, muốn đủ hai trục thì phải bật chấm hạnh kiểm.
        double cpSum = 0; int cpN = 0;
        for (CycleUserEvaluationResponse.PeriodBreakdown b : breakdown) {
            if (b.getCompletionPercent() != null) { cpSum += b.getCompletionPercent(); cpN++; }
        }
        Double avgCompletionPercent = cpN > 0 ? round(cpSum / cpN) : null;

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
                .userAvatarUrl(user.getAvatarUrl())
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
        // Chế độ Định tính: điểm chốt suy ra từ mức định tính (0..5 → pool chấm 0..100),
        // không nhận điểm định lượng nhập tay.
        if (mode == CycleEvaluationMode.QUALITATIVE) {
            finalScore = qualScore != null ? round(qualScore / 5.0 * EvaluationService.SCORING_POOL) : null;
        }

        // Tra ma trận hiệu suất của tổ chức: (mức định tính) × (TB % hoàn thành định lượng).
        // Dùng lại đúng hàm mà đánh giá theo đợt đang dùng.
        //
        // Ma trận cần ĐỦ HAI TRỤC THẬT. Một loại KPI chỉ cấp được một trục, nên kỳ chỉ chấm
        // định lượng (hoặc chỉ định tính) sẽ thiếu trục — trừ khi tổ chức bật chấm HẠNH KIỂM,
        // khi đó điểm hạnh kiểm bù đúng trục còn trống và kỳ mới ra được xếp loại 1..5.
        CycleUserEvaluationResponse computed = computeUser(cycle, user, finalizedUnits(cycleId));
        Organization org = cycle.getOrganization();
        Double rowScore = qualScore;
        // null = kỳ không có KPI định lượng nào ⇒ trục cột đang TRỐNG, chờ hạnh kiểm bù.
        Double colPercent = computed.getAvgCompletionPercent();
        if (org != null && Boolean.TRUE.equals(org.getEnableConduct())) {
            Double conduct = conductService.effectiveScore(userId, ConductScope.CYCLE, cycleId, org);
            Double conductMax = conductService.effectiveMaxScore(userId, ConductScope.CYCLE, cycleId, org);
            var axes = com.kpitracking.util.ConductAxisResolver.resolve(rowScore, colPercent, conduct, conductMax);
            rowScore = axes.behaviorScore();
            colPercent = axes.completionPercent();
        }
        // Thiếu trục nào (kể cả sau khi hạnh kiểm bù) ⇒ lookup trả null: kỳ không có xếp loại
        // ma trận, thay vì bịa một trục để ép ra hạng.
        String matrixJson = org != null ? org.getPerformanceMatrix() : null;
        Integer matrixRating = evaluationService.lookupMatrixRating(rowScore, colPercent, matrixJson);

        entity.setFinalScore(finalScore);
        entity.setQualScore(qualScore);
        entity.setMatrixRating(matrixRating);
        entity.setComment(comment);
        entity.setEvaluatedBy(getCurrentUser());
        entity.setEvaluatedAt(Instant.now());
        cycleUserEvaluationRepository.save(entity);

        return computeUser(cycle, user, finalizedUnits(cycleId));
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
            // Bản ghi chốt TRƯỚC khi có tính năng xếp loại theo kỳ chưa có snapshot xếp loại —
            // giữ số live để đơn vị không bị hiện "—" thay vì mất dữ liệu.
            if (saved.getClassification() != null) {
                live.setClassification(saved.getClassification());
                live.setClassificationColor(saved.getClassificationColor());
                live.setClassificationProfileName(saved.getClassificationProfile());
            }
        }
        return live;
    }

    /** Tính tổng hợp phòng ban trực tiếp từ thành viên (bỏ qua snapshot). */
    private CycleUnitEvaluationResponse computeUnitSummary(UUID cycleId, UUID orgUnitId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        CycleEvaluationMode mode = cycle.getEvaluationMode() != null ? cycle.getEvaluationMode() : CycleEvaluationMode.BOTH;

        List<CycleUserEvaluationResponse> members = new ArrayList<>();
        double selfSum = 0; int selfN = 0;
        double mgrSum = 0; int mgrN = 0;
        double qualSum = 0; int qualN = 0;
        double matrixSum = 0; int matrixN = 0;
        List<CycleUnitEvaluation> finalizedUnits = finalizedUnits(cycle.getId());
        // Điểm phòng ban gộp từ ĐIỂM CHỐT của từng nhân viên (đã tính cả phần chỉnh tay).
        for (User u : subtreeMembers(unit)) {
            CycleUserEvaluationResponse m = computeUser(cycle, u, finalizedUnits);
            members.add(m);
            if (m.getSelfScore() != null) { selfSum += m.getSelfScore(); selfN++; }
            if (m.getFinalScore() != null) { mgrSum += m.getFinalScore(); mgrN++; }
            if (m.getQualScore() != null) { qualSum += m.getQualScore(); qualN++; }
            if (m.getMatrixRating() != null) { matrixSum += m.getMatrixRating(); matrixN++; }
        }

        // Xếp loại đơn vị theo phân bố mức của thành viên TRONG KỲ. Truyền thẳng điểm kỳ vừa tính
        // để con số trên huy hiệu luôn khớp bảng bên dưới, thay vì để service kia tính lại từ DB.
        UnitClassificationService.UnitClassResult cls = unitClassificationService.classifyCycleUnit(
                cycle.getId(), unit, members.stream().map(this::cycleMemberScore).toList());

        return CycleUnitEvaluationResponse.builder()
                .cycleId(cycle.getId()).cycleName(cycle.getName())
                .orgUnitId(unit.getId()).orgUnitName(unit.getName())
                .mode(mode)
                .selfScore(selfN > 0 ? round(selfSum / selfN) : null)
                .managerScore(mgrN > 0 ? round(mgrSum / mgrN) : null)
                .qualScore(qualN > 0 ? round(qualSum / qualN) : null)
                .matrixRating(matrixN > 0 ? round(matrixSum / matrixN) : null)
                .memberCount(members.size())
                .classification(cls != null ? cls.level() : null)
                .classificationColor(cls != null ? cls.color() : null)
                .classificationProfileName(cls != null ? cls.profileName() : null)
                .status(CycleUnitEvalStatus.DRAFT)
                .members(members)
                .build();
    }

    /**
     * Điểm kỳ của một người dưới dạng đầu vào xếp loại đơn vị.
     *
     * <p>Xếp loại ma trận ở cấp kỳ chỉ có khi người đó đã được CHẤM ĐỊNH TÍNH cuối kỳ. Chưa chấm
     * thì lấy trung bình xếp loại ma trận các đợt — nếu không, đơn vị mới đánh giá được vài người
     * sẽ xếp loại trên một mẫu quá nhỏ.
     */
    private UnitClassificationService.CycleMemberScore cycleMemberScore(CycleUserEvaluationResponse m) {
        Double rating = m.getMatrixRating() != null ? m.getMatrixRating().doubleValue() : null;
        if (rating == null && m.getPeriodBreakdown() != null) {
            double sum = 0; int n = 0;
            for (CycleUserEvaluationResponse.PeriodBreakdown b : m.getPeriodBreakdown()) {
                if (b.getMatrixRating() != null) { sum += b.getMatrixRating(); n++; }
            }
            if (n > 0) rating = sum / n;
        }
        return new UnitClassificationService.CycleMemberScore(m.getFinalScore(), rating);
    }

    @Transactional
    public CycleUnitEvaluationResponse finalizeUnitCycle(UUID cycleId, UUID orgUnitId, String comment) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        assertCanManageUnit(orgUnitId);

        // Cấp trên đã chốt ⇒ khoá kế thừa xuống, không được chốt lại từ dưới.
        OrgUnit ancestor = lockingAncestor(unit, finalizedUnits(cycleId));
        if (ancestor != null) {
            throw new IllegalArgumentException("Đơn vị cấp trên \"" + ancestor.getName()
                    + "\" đã chốt kỳ. Hãy mở khoá ở đơn vị đó trước khi chốt lại.");
        }

        // Luôn TÍNH LẠI từ thành viên khi chốt (kể cả chốt lại), không lấy snapshot cũ.
        CycleUnitEvaluationResponse summary = computeUnitSummary(cycleId, orgUnitId);

        CycleUnitEvaluation entity = cycleUnitEvaluationRepository
                .findByKpiCycleIdAndOrgUnitId(cycleId, orgUnitId)
                .orElseGet(() -> CycleUnitEvaluation.builder().kpiCycle(cycle).orgUnit(unit).build());

        User current = getCurrentUser();

        // Chốt ĐÈ lên bản đã chốt cũng là một cách gỡ khoá của người khác
        // (finalizedBy bị ghi lại thành mình), nên phải qua đúng luật mở khoá.
        if (entity.getStatus() == CycleUnitEvalStatus.FINALIZED) {
            String denial = reopenDenialReason(entity, current.getId(), orgUnitId);
            if (denial != null) throw new com.kpitracking.exception.ForbiddenException(denial);
        }

        entity.setEvaluationMode(summary.getMode());
        entity.setSelfScore(summary.getSelfScore());
        entity.setManagerScore(summary.getManagerScore());
        entity.setQualScore(summary.getQualScore());
        entity.setMatrixRating(summary.getMatrixRating());
        entity.setMemberCount(summary.getMemberCount());
        entity.setClassification(summary.getClassification());
        entity.setClassificationColor(summary.getClassificationColor());
        entity.setClassificationProfile(summary.getClassificationProfileName());
        entity.setComment(comment);
        entity.setStatus(CycleUnitEvalStatus.FINALIZED);
        entity.setFinalizedBy(current);
        entity.setFinalizedAt(Instant.now());
        // Chụp cấp bậc lúc chốt: người này có thể được thăng/giáng chức sau đó,
        // tính lại live sẽ làm đổi ý nghĩa của khoá.
        entity.setFinalizedRoleLevel(permissionChecker.getMinLevelInOrgUnit(current.getId(), orgUnitId));
        entity.setFinalizedRoleRank(permissionChecker.getMinRankInOrgUnit(current.getId(), orgUnitId));
        cycleUnitEvaluationRepository.save(entity);

        recordEvent(cycle, unit, CycleUnitEvalAction.FINALIZE, current, summary, comment);

        return getUnitCycleSummary(cycleId, orgUnitId);
    }

    /** Mở khoá (đưa về DRAFT) để chỉnh lại điểm sau khi đã chốt. */
    @Transactional
    public CycleUnitEvaluationResponse reopenUnitCycle(UUID cycleId, UUID orgUnitId) {
        assertCanManageUnit(orgUnitId);
        CycleUnitEvaluation entity = cycleUnitEvaluationRepository
                .findByKpiCycleIdAndOrgUnitId(cycleId, orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đánh giá kỳ của phòng ban", "orgUnitId", orgUnitId));

        // Khoá kế thừa xuống ⇒ phải mở từ trên xuống.
        OrgUnit ancestor = lockingAncestor(entity.getOrgUnit(), finalizedUnits(cycleId));
        if (ancestor != null) {
            throw new IllegalArgumentException("Đơn vị cấp trên \"" + ancestor.getName()
                    + "\" đang chốt kỳ. Hãy mở khoá ở đơn vị đó trước.");
        }

        User current = getCurrentUser();
        String denial = reopenDenialReason(entity, current.getId(), orgUnitId);
        if (denial != null) throw new com.kpitracking.exception.ForbiddenException(denial);

        entity.setStatus(CycleUnitEvalStatus.DRAFT);
        entity.setFinalizedBy(null);
        entity.setFinalizedAt(null);
        entity.setFinalizedRoleLevel(null);
        entity.setFinalizedRoleRank(null);
        cycleUnitEvaluationRepository.save(entity);

        recordEvent(entity.getKpiCycle(), entity.getOrgUnit(), CycleUnitEvalAction.REOPEN,
                current, null, null);

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

    /**
     * Lý do KHÔNG được mở khoá, hoặc null nếu được phép.
     *
     * <p>Luật: chỉ người có cấp bậc TƯƠNG ĐƯƠNG hoặc CAO HƠN người đã chốt mới mở được.
     * So theo cặp (level, rank) — nhỏ hơn là cao hơn — nên Phó phòng (rank 1) không
     * mở được khoá do Trưởng phòng (rank 0) cùng đơn vị đặt. Người tự chốt luôn tự mở
     * được của mình, và global admin bỏ qua toàn bộ kiểm tra này.
     */
    private String reopenDenialReason(CycleUnitEvaluation entity, UUID currentUserId, UUID orgUnitId) {
        User locker = entity.getFinalizedBy();
        if (locker == null) return null;                                   // không rõ ai chốt ⇒ không chặn
        if (locker.getId().equals(currentUserId)) return null;             // tự mở khoá của mình
        if (permissionChecker.isGlobalAdmin(currentUserId)) return null;

        // Ưu tiên snapshot; bản ghi cũ chưa có snapshot thì tính lại live.
        int lockedLevel = entity.getFinalizedRoleLevel() != null
                ? entity.getFinalizedRoleLevel()
                : permissionChecker.getMinLevelInOrgUnit(locker.getId(), orgUnitId);
        int lockedRank = entity.getFinalizedRoleRank() != null
                ? entity.getFinalizedRoleRank()
                : permissionChecker.getMinRankInOrgUnit(locker.getId(), orgUnitId);

        // seniorityKey gộp (level, rank) thành 1 số, NHỎ hơn = cấp cao hơn.
        // "<=" nghĩa là tương đương cũng được, nhưng vì rank nằm trong khoá nên
        // Phó (rank 1) vẫn thua Trưởng (rank 0) cùng level.
        boolean allowed = permissionChecker.seniorityKeyInOrgUnit(currentUserId, orgUnitId)
                <= lockedLevel * 1000 + lockedRank;
        if (allowed) return null;

        String lockerRole = permissionChecker.getBestRoleNameInOrgUnit(locker.getId(), orgUnitId);
        return "Đánh giá kỳ này do " + locker.getFullName()
                + (lockerRole != null ? " (" + lockerRole + ")" : "") + " chốt. "
                + "Bạn cần cấp tương đương hoặc cao hơn mới mở khoá được.";
    }

    /** Ghi một mốc vào lịch sử chốt/mở khoá. */
    private void recordEvent(KpiCycle cycle, OrgUnit unit, CycleUnitEvalAction action,
                             User actor, CycleUnitEvaluationResponse summary, String comment) {
        cycleUnitEvalEventRepository.save(CycleUnitEvalEvent.builder()
                .kpiCycle(cycle)
                .orgUnit(unit)
                .action(action)
                .actor(actor)
                .actorRoleName(permissionChecker.getBestRoleNameInOrgUnit(actor.getId(), unit.getId()))
                .actorRoleLevel(permissionChecker.getMinLevelInOrgUnit(actor.getId(), unit.getId()))
                .actorRoleRank(permissionChecker.getMinRankInOrgUnit(actor.getId(), unit.getId()))
                .managerScore(summary != null ? summary.getManagerScore() : null)
                .qualScore(summary != null ? summary.getQualScore() : null)
                .matrixRating(summary != null ? summary.getMatrixRating() : null)
                .memberCount(summary != null ? summary.getMemberCount() : null)
                .comment(comment)
                .build());
    }

    /** Các bản tổng hợp phòng ban ĐÃ CHỐT của kỳ (nạp 1 lần cho cả request). */
    // Luật khoá theo kỳ nằm ở CycleLockChecker để ConductService dùng chung mà không tạo
    // vòng phụ thuộc bean. Ba hàm dưới đây chỉ là lối tắt cho các chỗ gọi sẵn có.

    private List<CycleUnitEvaluation> finalizedUnits(UUID cycleId) {
        return cycleLockChecker.finalizedUnits(cycleId);
    }

    private OrgUnit lockingUnit(OrgUnit userUnit, List<CycleUnitEvaluation> finalizedUnits) {
        return cycleLockChecker.lockingUnit(userUnit, finalizedUnits);
    }

    private OrgUnit lockingAncestor(OrgUnit unit, List<CycleUnitEvaluation> finalizedUnits) {
        return cycleLockChecker.lockingAncestor(unit, finalizedUnits);
    }

    // ─────────────────────── Gửi kết quả đánh giá cho nhân viên ───────────────────────

    /**
     * Chuẩn bị sẵn nội dung email cho từng nhân viên được chọn.
     *
     * <p>Cố ý tách khỏi bước GỬI: gửi SMTP mất hàng giây mỗi email, để trong
     * transaction sẽ giữ connection DB suốt cả lượt. Ở đây đọc xong dữ liệu là
     * đóng transaction, {@code CycleEvaluationMailer} mới đi gửi bên ngoài.
     */
    @Transactional(readOnly = true)
    public List<PreparedCycleEmail> prepareCycleEvaluationEmails(UUID cycleId, UUID orgUnitId, List<UUID> userIds) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

        User sender = getCurrentUser();
        if (!permissionChecker.hasPermissionInOrgUnit(sender.getId(), "CYCLE_EVAL:SEND", orgUnitId)) {
            throw new com.kpitracking.exception.ForbiddenException(
                    "Bạn không có quyền gửi kết quả đánh giá kỳ của đơn vị này");
        }
        if (userIds == null || userIds.isEmpty()) {
            throw new IllegalArgumentException("Hãy chọn ít nhất một nhân viên để gửi");
        }

        UUID orgId = cycle.getOrganization() != null ? cycle.getOrganization().getId() : null;
        List<CycleUnitEvaluation> finalized = finalizedUnits(cycleId);

        List<PreparedCycleEmail> prepared = new ArrayList<>();
        for (UUID userId : userIds) {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                prepared.add(new PreparedCycleEmail(userId.toString(), null, null, Map.of(), null, null));
                continue;
            }
            CycleUserEvaluationResponse eval = computeUser(cycle, user, finalized);
            // Dựng tệp đính kèm ngay tại đây, khi dữ liệu vừa tính xong còn trong tay —
            // để lớp gửi mail phải hỏi lại thì mỗi email là thêm một lượt truy vấn.
            byte[] excel = CycleEvaluationExcelWriter.build(
                    eval, cycle.getName(), eval.getOrgUnitName(), EvaluationService.SCORING_POOL,
                    scoreLabel(cycle.getOrganization(), eval.getFinalScore()));
            prepared.add(new PreparedCycleEmail(
                    user.getFullName(), user.getEmail(), orgId,
                    cycleEvaluationVariables(cycle, user, eval, sender),
                    CycleEvaluationExcelWriter.fileName(user.getFullName(), cycle.getName()), excel));
        }
        return prepared;
    }

    /**
     * Một email đã sẵn sàng gửi. {@code email} null/rỗng ⇒ người này không có địa chỉ nhận;
     * {@code attachment} null/rỗng ⇒ không dựng được tệp, vẫn gửi mail như thường.
     */
    public record PreparedCycleEmail(String recipientName, String email, UUID orgId,
                                     Map<String, String> variables,
                                     String attachmentName, byte[] attachment) {}

    /** Kết quả gửi hàng loạt: số gửi được và tên những người gửi hỏng. */
    public record SendCycleEvaluationResult(int sent, List<String> failed) {}

    private Map<String, String> cycleEvaluationVariables(KpiCycle cycle, User user,
                                                         CycleUserEvaluationResponse eval,
                                                         User sender) {
        boolean isQual = eval.getMode() == CycleEvaluationMode.QUALITATIVE;
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("ten_nhan_vien", nullSafe(user.getFullName()));
        vars.put("don_vi", nullSafe(eval.getOrgUnitName()));
        vars.put("ky_danh_gia", nullSafe(cycle.getName()));
        vars.put("diem_tu_danh_gia", scoreText(eval.getSelfScore(), isQual));
        vars.put("diem_qltt", scoreText(eval.getManagerScore(), isQual));
        vars.put("diem_chot", scoreText(eval.getFinalScore(), isQual));
        vars.put("xep_loai", scoreLabel(cycle.getOrganization(), eval.getFinalScore()));
        vars.put("muc_dinh_tinh", eval.getQualScore() != null ? eval.getQualScore() + "/5" : "—");
        vars.put("xep_loai_ma_tran", eval.getMatrixRating() != null ? eval.getMatrixRating() + "/5" : "—");
        vars.put("nhan_xet", eval.getComment() != null && !eval.getComment().isBlank()
                ? eval.getComment() : "Không có nhận xét thêm.");
        vars.put("bang_diem_dot", periodTableHtml(eval, isQual));
        vars.put("nguoi_gui", nullSafe(sender.getFullName()));
        return vars;
    }

    /** Bảng HTML điểm từng đợt, chèn vào biến {{bang_diem_dot}} của template. */
    private String periodTableHtml(CycleUserEvaluationResponse eval, boolean isQual) {
        List<CycleUserEvaluationResponse.PeriodBreakdown> rows = eval.getPeriodBreakdown();
        if (rows == null || rows.isEmpty()) {
            return "<p style='color:#94a3b8;font-style:italic;'>Kỳ này chưa có đợt nào được gán.</p>";
        }
        StringBuilder sb = new StringBuilder("<table class='score-table'><tr><th>Đợt</th>"
                + "<th>Tự đánh giá</th><th>QLTT đánh giá</th></tr>");
        for (CycleUserEvaluationResponse.PeriodBreakdown p : rows) {
            sb.append("<tr><td>").append(escapeHtml(p.getPeriodName())).append("</td>")
              .append("<td>").append(scoreText(p.getSelfScore(), isQual)).append("</td>")
              .append("<td>").append(scoreText(p.getManagerScore(), isQual)).append("</td></tr>");
        }
        return sb.append("</table>").toString();
    }

    /**
     * Nhãn xếp loại theo thang điểm của tổ chức (Xuất sắc / Tốt / Khá...).
     * Cùng luật với {@code UnitClassificationService.memberClassifier}: lấy mức đầu tiên
     * có ngưỡng <= điểm, xét từ cao xuống thấp.
     */
    private String scoreLabel(Organization org, Double score) {
        if (score == null || org == null || org.getEvaluationLevels() == null) return "—";
        List<EvaluationLevel> levels = org.getEvaluationLevels().stream()
                .sorted(Comparator.comparingDouble(EvaluationLevel::getThreshold).reversed())
                .toList();
        for (EvaluationLevel l : levels) {
            if (score >= l.getThreshold()) return l.getName();
        }
        return levels.isEmpty() ? "—" : levels.get(levels.size() - 1).getName();
    }

    /** Chế độ Định tính hiển thị lại mức gốc 0–5 thay vì số đã quy đổi sang thang điểm. */
    private String scoreText(Double v, boolean isQual) {
        if (v == null) return "—";
        if (!isQual) return String.valueOf(v);
        return (Math.round(v / EvaluationService.SCORING_POOL * 5 * 100) / 100.0) + "/5";
    }

    private String nullSafe(String s) {
        return s != null ? s : "—";
    }

    private String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    // ─────────────────────────── Chuỗi duyệt theo cấp ───────────────────────────

    /**
     * Chuỗi duyệt của một kỳ: đơn vị đang xem, rồi lần lượt các đơn vị CHA lên tới gốc
     * (VD Tổ → Chi nhánh → Công ty). Mỗi bước kèm trạng thái chốt, người chốt, lịch sử,
     * và quyền chốt/mở khoá đã tính sẵn cho người dùng hiện tại.
     *
     * <p>Cố ý KHÔNG tính điểm live cho các đơn vị cha: {@code computeUnitSummary} duyệt
     * toàn bộ subtree nên gọi cho cả chuỗi sẽ rất nặng. Đơn vị chưa chốt trả điểm null;
     * điểm live của đơn vị đang xem thì FE đã có sẵn từ endpoint summary.
     */
    @Transactional(readOnly = true)
    public List<CycleApprovalStepResponse> getApprovalChain(UUID cycleId, UUID orgUnitId) {
        kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

        // Đi ngược lên gốc. Chặn vòng lặp phòng dữ liệu cây bị hỏng.
        List<OrgUnit> chain = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (OrgUnit u = unit; u != null && seen.add(u.getId()); u = u.getParent()) {
            chain.add(u);
        }

        List<UUID> chainIds = chain.stream().map(OrgUnit::getId).toList();
        Map<UUID, CycleUnitEvaluation> saved = new HashMap<>();
        for (CycleUnitEvaluation e : cycleUnitEvaluationRepository.findByKpiCycleId(cycleId)) {
            if (e.getOrgUnit() != null) saved.put(e.getOrgUnit().getId(), e);
        }
        Set<UUID> finalizedIds = saved.values().stream()
                .filter(e -> e.getStatus() == CycleUnitEvalStatus.FINALIZED)
                .map(e -> e.getOrgUnit().getId())
                .collect(java.util.stream.Collectors.toSet());

        Map<UUID, List<CycleUnitEvalEventResponse>> eventsByUnit = new HashMap<>();
        for (CycleUnitEvalEvent ev : cycleUnitEvalEventRepository
                .findByKpiCycleIdAndOrgUnitIdInOrderByCreatedAtAsc(cycleId, chainIds)) {
            eventsByUnit.computeIfAbsent(ev.getOrgUnit().getId(), k -> new ArrayList<>())
                    .add(CycleUnitEvalEventResponse.builder()
                            .action(ev.getAction())
                            .actorName(ev.getActor() != null ? ev.getActor().getFullName() : null)
                            .actorRoleName(ev.getActorRoleName())
                            .managerScore(ev.getManagerScore())
                            .comment(ev.getComment())
                            .createdAt(ev.getCreatedAt())
                            .build());
        }

        User current = getCurrentUser();
        List<CycleUnitEvaluation> finalizedUnits = finalizedUnits(cycleId);
        List<CycleApprovalStepResponse> steps = new ArrayList<>();

        for (OrgUnit u : chain) {
            CycleUnitEvaluation e = saved.get(u.getId());
            boolean isFinalized = e != null && e.getStatus() == CycleUnitEvalStatus.FINALIZED;

            List<OrgUnit> children = orgUnitRepository.findByParentId(u.getId()).stream()
                    .filter(c -> c.getDeletedAt() == null)
                    .toList();
            int childFinalized = (int) children.stream().filter(c -> finalizedIds.contains(c.getId())).count();

            boolean hasRight = permissionChecker.hasPermissionInOrgUnit(
                    current.getId(), "CYCLE_EVAL:FINALIZE", u.getId());
            OrgUnit ancestor = lockingAncestor(u, finalizedUnits);

            boolean canFinalize = false;
            boolean canReopen = false;
            String blockedReason = null;

            if (!hasRight) {
                blockedReason = "Bạn không có quyền chốt hoặc mở khoá đánh giá kỳ của đơn vị này";
            } else if (ancestor != null) {
                blockedReason = "Đơn vị cấp trên \"" + ancestor.getName()
                        + "\" đang chốt kỳ. Hãy mở khoá ở đơn vị đó trước.";
            } else if (isFinalized) {
                blockedReason = reopenDenialReason(e, current.getId(), u.getId());
                canReopen = blockedReason == null;
            } else {
                canFinalize = true;
            }

            OrgHierarchyLevel hl = u.getOrgHierarchyLevel();
            String roleLabel = hl != null && hl.getManagerRoleLabel() != null && !hl.getManagerRoleLabel().isBlank()
                    ? hl.getManagerRoleLabel()
                    : (hl != null ? "Trưởng " + hl.getUnitTypeName() : null);

            steps.add(CycleApprovalStepResponse.builder()
                    .orgUnitId(u.getId())
                    .orgUnitName(u.getName())
                    .managerRoleLabel(roleLabel)
                    .levelOrder(hl != null ? hl.getLevelOrder() : null)
                    .current(u.getId().equals(orgUnitId))
                    .status(e != null ? e.getStatus() : CycleUnitEvalStatus.DRAFT)
                    .managerScore(isFinalized ? e.getManagerScore() : null)
                    .qualScore(isFinalized ? e.getQualScore() : null)
                    .matrixRating(isFinalized ? e.getMatrixRating() : null)
                    .memberCount(isFinalized ? e.getMemberCount() : null)
                    .finalizedByName(isFinalized && e.getFinalizedBy() != null
                            ? e.getFinalizedBy().getFullName() : null)
                    .finalizedByRoleName(isFinalized && e.getFinalizedBy() != null
                            ? permissionChecker.getBestRoleNameInOrgUnit(e.getFinalizedBy().getId(), u.getId()) : null)
                    .finalizedAt(isFinalized ? e.getFinalizedAt() : null)
                    .comment(e != null ? e.getComment() : null)
                    .childTotal(children.size())
                    .childFinalized(childFinalized)
                    .canFinalize(canFinalize)
                    .canReopen(canReopen)
                    .blockedReason(blockedReason)
                    .events(eventsByUnit.getOrDefault(u.getId(), List.of()))
                    .build());
        }

        // Trả từ DƯỚI lên (đơn vị đang xem trước) — đúng thứ tự duyệt thực tế.
        return steps;
    }

    // ─────────────────────────────── Helpers ───────────────────────────────

    /** Điểm theo chiều được chọn, quy về pool chấm 0..100. Null nếu chưa có dữ liệu. */
    private Double pickDimension(Evaluation e, CycleEvaluationMode mode) {
        if (e == null) return null;
        switch (mode) {
            case QUANTITATIVE:
                return e.getSystemScore();
            case QUALITATIVE:
                // behaviorScore thang 0..5 → quy về pool chấm 0..100 cho đồng nhất hiển thị.
                return e.getBehaviorScore() != null ? e.getBehaviorScore() / 5.0 * EvaluationService.SCORING_POOL : null;
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


    // ============================================================
    // DANH SÁCH TOÀN PHẠM VI (cho bảng theo dõi chốt kỳ & xếp hạng)
    // ============================================================

    /**
     * Trạng thái chốt kỳ của MỌI đơn vị trong phạm vi người gọi.
     *
     * <p>Trước đây chỉ có bản tra từng đơn vị một, nên muốn biết "còn phòng nào chưa chốt"
     * thì giao diện phải gọi N request. Ở đây trả một lần, đã giới hạn theo cây đơn vị mà
     * người gọi phụ trách để không lộ đơn vị ngoài phạm vi.
     */
    @Transactional(readOnly = true)
    public List<CycleUnitStatusResponse> listUnitStatuses(UUID cycleId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));

        List<OrgUnit> scope = unitsInScope(cycle);
        if (scope.isEmpty()) return List.of();

        Map<UUID, CycleUnitEvaluation> saved = new HashMap<>();
        cycleUnitEvaluationRepository.findByKpiCycleId(cycleId)
                .forEach(e -> saved.put(e.getOrgUnit().getId(), e));

        return scope.stream()
                .map(unit -> {
                    CycleUnitEvaluation e = saved.get(unit.getId());
                    boolean finalized = e != null && e.getStatus() == CycleUnitEvalStatus.FINALIZED;
                    return CycleUnitStatusResponse.builder()
                            .orgUnitId(unit.getId())
                            .orgUnitName(unit.getName())
                            .levelOrder(unit.getOrgHierarchyLevel() != null
                                    ? unit.getOrgHierarchyLevel().getLevelOrder() : null)
                            // Chưa có bản ghi nghĩa là chưa ai đụng tới, không phải lỗi dữ liệu
                            .status(e != null ? e.getStatus() : CycleUnitEvalStatus.DRAFT)
                            .memberCount(e != null && e.getMemberCount() != null ? e.getMemberCount() : 0)
                            .managerScore(e != null ? e.getManagerScore() : null)
                            .qualScore(e != null ? e.getQualScore() : null)
                            .matrixRating(e != null ? e.getMatrixRating() : null)
                            // Chỉ hiện xếp loại của bản ĐÃ CHỐT: đơn vị mở khoá chỉnh lại điểm
                            // vẫn còn snapshot cũ, hiện lên sẽ thành con số đã hết hiệu lực.
                            .classification(finalized ? e.getClassification() : null)
                            .classificationColor(finalized ? e.getClassificationColor() : null)
                            .finalizedByName(e != null && e.getFinalizedBy() != null
                                    ? e.getFinalizedBy().getFullName() : null)
                            .finalizedAt(e != null ? e.getFinalizedAt() : null)
                            .build();
                })
                .sorted(Comparator
                        .comparing(CycleUnitStatusResponse::getLevelOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(CycleUnitStatusResponse::getOrgUnitName, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /**
     * Bảng xếp hạng chốt kỳ trong phạm vi người gọi.
     *
     * <p>Người chưa có điểm vẫn được trả về (rank = null) chứ không bị lọc bỏ: quản lý cần
     * thấy ai còn thiếu điểm, đó mới là việc phải xử lý.
     */
    @Transactional(readOnly = true)
    public List<CycleUserRankResponse> listUserRankings(UUID cycleId) {
        KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));

        Set<UUID> scopeUnitIds = new HashSet<>(unitsInScope(cycle).stream().map(OrgUnit::getId).toList());
        if (scopeUnitIds.isEmpty()) return List.of();

        List<CycleUserRankResponse> rows = cycleUserEvaluationRepository.findAllForCycle(cycleId).stream()
                .map(e -> {
                    User u = e.getUser();
                    OrgUnit unit = primaryUnitOf(u.getId());
                    if (unit == null || !scopeUnitIds.contains(unit.getId())) return null;
                    return CycleUserRankResponse.builder()
                            .userId(u.getId())
                            .userName(u.getFullName())
                            .userAvatarUrl(u.getAvatarUrl())
                            .orgUnitName(unit.getName())
                            .finalScore(e.getFinalScore())
                            .qualScore(e.getQualScore())
                            .matrixRating(e.getMatrixRating())
                            .build();
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(CycleUserRankResponse::getFinalScore,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(java.util.stream.Collectors.toList());

        int rank = 0;
        for (CycleUserRankResponse row : rows) {
            if (row.getFinalScore() != null) row.setRank(++rank);
        }
        return rows;
    }

    /** Cây đơn vị mà người gọi được xem trong kỳ này. */
    private List<OrgUnit> unitsInScope(KpiCycle cycle) {
        User current = getCurrentUser();
        UUID orgId = cycle.getOrganization() != null ? cycle.getOrganization().getId() : null;
        if (orgId == null) return List.of();

        List<UUID> myUnitIds = userRoleOrgUnitRepository.findByUserId(current.getId()).stream()
                .map(a -> a.getOrgUnit() != null ? a.getOrgUnit().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (myUnitIds.isEmpty()) return List.of();

        return orgUnitRepository.findAllInSubtrees(myUnitIds, orgId);
    }

    private OrgUnit primaryUnitOf(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
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
