package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.EvaluationPerspectiveScore;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Tính điểm BSC.
 *
 * CÔNG THỨC 2 TẦNG (xem plan "Quy tắc chấm điểm"):
 *   Tầng trong  — điểm 1 lĩnh vực P của nhân viên E (trung bình có trọng số, chuẩn hóa trong lĩnh vực):
 *                 raw_P(E) = Σ(kpi_ratio_i × weight_i) / Σ(weight_i) × 100, với i ∈ KPI của E thuộc P
 *                 = null nếu E không có KPI nào trong P (lĩnh vực rỗng)
 *   Tầng ngoài  — điểm BSC cuối:
 *                 RENORMALIZE: bsc = Σ(W_P × raw_P) / Σ(W_P) chỉ tính lĩnh vực raw_P ≠ null
 *                 ZERO_FILL  : bsc = Σ(W_P × (raw_P ?? 0)) / Σ(W_P) toàn bộ lĩnh vực
 *
 * Trọng số lĩnh vực (W_P) dùng chung toàn tổ chức mỗi kỳ (lấy từ scorecard);
 * raw_P tính RIÊNG cho từng nhân viên từ KPI cá nhân của họ.
 *
 * kpi_ratio dùng KpiAchievementCalculator — CÙNG công thức với system_score để hai điểm so sánh được.
 */
@Service
@RequiredArgsConstructor
public class BscScoringService {

    private final BscScorecardRepository scorecardRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiAchievementCalculator achievementCalculator;
    private final BscPerspectiveRepository perspectiveRepository;
    private final EvaluationPerspectiveScoreRepository perspectiveScoreRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    /**
     * Trạng thái KPI được tính vào bộ tiêu chí. CŨNG dùng bởi KpiCriteriaService ⇒ số KPI
     * "được tính điểm" ở hai nơi khớp nhau.
     */
    public static final List<KpiStatus> ACTIVE_STATUSES = Arrays.asList(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);

    /** Kết quả điểm BSC của một nhân viên trong một kỳ. */
    @Getter
    public static class BscUserScore {
        private final Double bscScore;
        private final List<PerspectiveScoreResponse> perspectives;
        private final List<String> unassignedKpiNames;
        /** Chế độ chấm điểm của bộ tiêu chí ĐÃ ÁP DỤNG cho nhân viên này (theo phòng ban). */
        private final BscScoringMode scoringMode;

        BscUserScore(Double bscScore, List<PerspectiveScoreResponse> perspectives, List<String> unassignedKpiNames, BscScoringMode scoringMode) {
            this.bscScore = bscScore;
            this.perspectives = perspectives;
            this.unassignedKpiNames = unassignedKpiNames;
            this.scoringMode = scoringMode;
        }

        public int getUnassignedKpiCount() { return unassignedKpiNames.size(); }

        /** % KPI tính điểm đã được gán lĩnh vực (100 = đủ, < 100 = còn KPI chưa gán). */
        public Double getCoveragePercent() {
            int assigned = perspectives.stream().mapToInt(p -> p.getKpiCount() != null ? p.getKpiCount() : 0).sum();
            int total = assigned + unassignedKpiNames.size();
            return total > 0 ? (assigned * 100.0) / total : 100.0;
        }
    }

    // ============================================================
    // Điểm BSC cá nhân (GĐ3) — dùng trong Evaluation
    // ============================================================

    /**
     * Tính điểm BSC cho 1 nhân viên trong 1 kỳ.
     * Trả về null nếu kỳ đó chưa có bộ tiêu chí (không có trọng số ⇒ không tính được điểm BSC).
     */
    @Transactional(readOnly = true)
    public BscUserScore computeForUser(UUID userId, UUID kpiPeriodId, UUID organizationId, boolean enableWaterfall) {
        // Bộ tiêu chí áp dụng cho nhân viên = bộ tiêu chí phòng ban của họ → cha gần nhất → mặc định org.
        BscScorecard scorecard = resolveScorecard(userOrgUnit(userId), organizationId, kpiPeriodId);
        if (scorecard == null) return null;

        List<KpiCriteria> kpis = kpiCriteriaRepository
                .findByUserIdInAssigneesAndKpiPeriodId(userId, kpiPeriodId, ACTIVE_STATUSES, Pageable.unpaged())
                .getContent();

        List<PerspectiveScoreResponse> breakdown = new ArrayList<>();
        double weightedSum = 0.0, presentWeight = 0.0, totalWeight = 0.0;
        boolean zeroFill = scorecard.getEmptyPerspectivePolicy() == BscEmptyPerspectivePolicy.ZERO_FILL;

        for (BscScorecardPerspective sp : scorecard.getScorecardPerspectives()) {
            UUID pid = sp.getPerspective().getId();
            double weight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
            totalWeight += weight;

            double ratioWeightSum = 0.0, weightSum = 0.0;
            int kpiCount = 0;
            for (KpiCriteria kpi : kpis) {
                // BSC tính CẢ KPI định lượng lẫn định tính (định tính quy ra % theo score_percent do HR cấu hình).
                if (!achievementCalculator.countsTowardBscScore(kpi)) continue;
                UUID eff = effectivePerspectiveId(kpi);
                if (eff == null || !eff.equals(pid)) continue;
                kpiCount++;
                Double ratio = achievementCalculator.bscRatio(kpi, userId, enableWaterfall);
                if (ratio == null) continue; // định tính chưa chấm / chưa cấu hình % ⇒ loại khỏi điểm
                ratioWeightSum += ratio * kpi.getWeight();
                weightSum += kpi.getWeight();
            }

            Double raw = weightSum > 0 ? (ratioWeightSum / weightSum) * 100.0 : null;
            Double weighted = raw != null ? (weight / 100.0) * raw : null;
            if (raw != null) {
                weightedSum += weight * raw;
                presentWeight += weight;
            }

            breakdown.add(PerspectiveScoreResponse.builder()
                    .perspectiveId(pid)
                    .code(sp.getPerspective().getCode())
                    .name(sp.getPerspective().getName())
                    .color(sp.getPerspective().getColor())
                    .fixedPerspective(fixedCode(sp.getPerspective()))
                    .fixedPerspectiveName(fixedName(sp.getPerspective()))
                    .fixedPerspectiveColor(fixedColor(sp.getPerspective()))
                    .weightPercentage(weight)
                    .kpiCount(kpiCount)
                    .achievementPercent(raw)
                    .weightedScore(weighted)
                    .build());
        }

        Double bsc;
        if (zeroFill) {
            bsc = totalWeight > 0 ? weightedSum / totalWeight : null;
        } else {
            bsc = presentWeight > 0 ? weightedSum / presentWeight : null;
        }

        // KPI tính điểm BSC (cả định lượng lẫn định tính) nhưng CHƯA gán lĩnh vực → cảnh báo coverage
        List<String> unassigned = kpis.stream()
                .filter(achievementCalculator::countsTowardBscScore)
                .filter(k -> effectivePerspectiveId(k) == null)
                .map(KpiCriteria::getName)
                .toList();

        return new BscUserScore(bsc, breakdown, unassigned, scorecard.getScoringMode());
    }

    /** Lưu breakdown điểm từng lĩnh vực của một đánh giá (ghi đè bản cũ). */
    @Transactional
    public void persistBreakdown(Evaluation evaluation, BscUserScore score) {
        perspectiveScoreRepository.deleteByEvaluationId(evaluation.getId());
        if (score == null) return;
        for (PerspectiveScoreResponse p : score.getPerspectives()) {
            BscPerspective perspective = perspectiveRepository.findById(p.getPerspectiveId()).orElse(null);
            if (perspective == null) continue;
            perspectiveScoreRepository.save(EvaluationPerspectiveScore.builder()
                    .evaluation(evaluation)
                    .perspective(perspective)
                    .weightPercentage(p.getWeightPercentage())
                    .rawScore(p.getAchievementPercent())
                    .weightedScore(p.getWeightedScore())
                    .kpiCount(p.getKpiCount() != null ? p.getKpiCount() : 0)
                    .build());
        }
    }

    /** Đọc breakdown điểm lĩnh vực đã lưu của một đánh giá. */
    @Transactional(readOnly = true)
    public List<PerspectiveScoreResponse> getBreakdown(UUID evaluationId) {
        return perspectiveScoreRepository.findByEvaluationId(evaluationId).stream()
                .map(s -> PerspectiveScoreResponse.builder()
                        .perspectiveId(s.getPerspective().getId())
                        .code(s.getPerspective().getCode())
                        .name(s.getPerspective().getName())
                        .color(s.getPerspective().getColor())
                        .fixedPerspective(fixedCode(s.getPerspective()))
                        .fixedPerspectiveName(fixedName(s.getPerspective()))
                        .fixedPerspectiveColor(fixedColor(s.getPerspective()))
                        .weightPercentage(s.getWeightPercentage())
                        .kpiCount(s.getKpiCount())
                        .achievementPercent(s.getRawScore())
                        .weightedScore(s.getWeightedScore())
                        .build())
                .toList();
    }

    /**
     * Chế độ chấm điểm áp dụng cho MỘT phòng ban trong kỳ (null nếu không có bộ tiêu chí nào áp dụng).
     * Dùng bộ tiêu chí của phòng ban → cha gần nhất → mặc định org (org_unit = NULL).
     */
    @Transactional(readOnly = true)
    public BscScoringMode getScoringMode(OrgUnit orgUnit, UUID organizationId, UUID kpiPeriodId) {
        BscScorecard sc = resolveScorecard(orgUnit, organizationId, kpiPeriodId);
        return sc != null ? sc.getScoringMode() : null;
    }

    /**
     * Tìm bộ tiêu chí HIỆU LỰC: bắt đầu từ phòng ban {@code orgUnit}, đi ngược lên các phòng ban cha
     * lấy bộ tiêu chí gần nhất; nếu không có ⇒ dùng bộ tiêu chí MẶC ĐỊNH toàn org (org_unit = NULL).
     */
    @Transactional(readOnly = true)
    public BscScorecard resolveScorecard(OrgUnit orgUnit, UUID organizationId, UUID kpiPeriodId) {
        OrgUnit cur = orgUnit;
        int guard = 0; // chặn vòng lặp vô hạn nếu dữ liệu cây bị lỗi
        while (cur != null && guard++ < 100) {
            BscScorecard sc = scorecardRepository
                    .findByOrgUnitAndPeriod(organizationId, cur.getId(), kpiPeriodId)
                    .orElse(null);
            if (sc != null) return sc;
            cur = cur.getParent();
        }
        return scorecardRepository
                .findDefaultByPeriod(organizationId, kpiPeriodId)
                .orElse(null);
    }

    /** Phòng ban của một nhân viên (lấy role đầu tiên) — null nếu không xác định được. */
    private OrgUnit userOrgUnit(UUID userId) {
        if (userId == null) return null;
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(userId);
        return roles.isEmpty() ? null : roles.get(0).getOrgUnit();
    }

    private static String fixedCode(BscPerspective p) {
        return p != null && p.getFixedPerspective() != null ? p.getFixedPerspective().name() : null;
    }
    private static String fixedName(BscPerspective p) {
        return p != null && p.getFixedPerspective() != null ? p.getFixedPerspective().getDisplayName() : null;
    }
    private static String fixedColor(BscPerspective p) {
        return p != null && p.getFixedPerspective() != null ? p.getFixedPerspective().getColor() : null;
    }

    /**
     * Điểm chính thức = bsc_score khi kỳ ở chế độ OFFICIAL và có điểm BSC; ngược lại giữ system_score.
     * Thuần chọn field — KHÔNG tính lại gì, nên đổi SHADOW↔OFFICIAL không cần recompute.
     */
    public Double resolveOfficialScore(Double systemScore, Double bscScore, BscScoringMode mode) {
        if (mode == BscScoringMode.OFFICIAL && bscScore != null) return bscScore;
        return systemScore;
    }

    /**
     * Lĩnh vực hiệu lực của KPI: ưu tiên gán TRỰC TIẾP trên KPI; nếu chưa có thì SUY từ
     * lĩnh vực của Objective cha (qua KeyResult) — dùng chung logic với KpiCriteriaMapper.
     */
    private UUID effectivePerspectiveId(KpiCriteria kpi) {
        return com.kpitracking.util.BscPerspectiveResolver.effectivePerspectiveId(kpi);
    }
}
