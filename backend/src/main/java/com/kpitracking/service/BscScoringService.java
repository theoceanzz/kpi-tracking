package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.BscDashboardResponse;
import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.EvaluationPerspectiveScore;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
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
 *   Tầng trong  — điểm 1 viễn cảnh P của nhân viên E (trung bình có trọng số, chuẩn hóa trong viễn cảnh):
 *                 raw_P(E) = Σ(kpi_ratio_i × weight_i) / Σ(weight_i) × 100, với i ∈ KPI của E thuộc P
 *                 = null nếu E không có KPI nào trong P (viễn cảnh rỗng)
 *   Tầng ngoài  — điểm BSC cuối:
 *                 RENORMALIZE: bsc = Σ(W_P × raw_P) / Σ(W_P) chỉ tính viễn cảnh raw_P ≠ null
 *                 ZERO_FILL  : bsc = Σ(W_P × (raw_P ?? 0)) / Σ(W_P) toàn bộ viễn cảnh
 *
 * Trọng số viễn cảnh (W_P) dùng chung toàn tổ chức mỗi kỳ (lấy từ scorecard);
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

    private static final List<KpiStatus> ACTIVE_STATUSES = Arrays.asList(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);

    /** Kết quả điểm BSC của một nhân viên trong một kỳ. */
    @Getter
    public static class BscUserScore {
        private final Double bscScore;
        private final List<PerspectiveScoreResponse> perspectives;
        private final List<String> unassignedKpiNames;

        BscUserScore(Double bscScore, List<PerspectiveScoreResponse> perspectives, List<String> unassignedKpiNames) {
            this.bscScore = bscScore;
            this.perspectives = perspectives;
            this.unassignedKpiNames = unassignedKpiNames;
        }

        public int getUnassignedKpiCount() { return unassignedKpiNames.size(); }

        /** % KPI tính điểm đã được gán viễn cảnh (100 = đủ, < 100 = còn KPI chưa gán). */
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
     * Trả về null nếu kỳ đó chưa có thẻ điểm (không có trọng số ⇒ không tính được điểm BSC).
     */
    @Transactional(readOnly = true)
    public BscUserScore computeForUser(UUID userId, UUID kpiPeriodId, UUID organizationId, boolean enableWaterfall) {
        BscScorecard scorecard = scorecardRepository
                .findByOrganizationIdAndKpiPeriodId(organizationId, kpiPeriodId).orElse(null);
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

        // KPI tính điểm BSC (cả định lượng lẫn định tính) nhưng CHƯA gán viễn cảnh → cảnh báo coverage
        List<String> unassigned = kpis.stream()
                .filter(achievementCalculator::countsTowardBscScore)
                .filter(k -> effectivePerspectiveId(k) == null)
                .map(KpiCriteria::getName)
                .toList();

        return new BscUserScore(bsc, breakdown, unassigned);
    }

    /** Lưu breakdown điểm từng viễn cảnh của một đánh giá (ghi đè bản cũ). */
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

    /** Đọc breakdown điểm viễn cảnh đã lưu của một đánh giá. */
    @Transactional(readOnly = true)
    public List<PerspectiveScoreResponse> getBreakdown(UUID evaluationId) {
        return perspectiveScoreRepository.findByEvaluationId(evaluationId).stream()
                .map(s -> PerspectiveScoreResponse.builder()
                        .perspectiveId(s.getPerspective().getId())
                        .code(s.getPerspective().getCode())
                        .name(s.getPerspective().getName())
                        .color(s.getPerspective().getColor())
                        .weightPercentage(s.getWeightPercentage())
                        .kpiCount(s.getKpiCount())
                        .achievementPercent(s.getRawScore())
                        .weightedScore(s.getWeightedScore())
                        .build())
                .toList();
    }

    /** Chế độ chấm điểm của kỳ (null nếu kỳ chưa có thẻ điểm). */
    @Transactional(readOnly = true)
    public BscScoringMode getScoringMode(UUID organizationId, UUID kpiPeriodId) {
        return scorecardRepository.findByOrganizationIdAndKpiPeriodId(organizationId, kpiPeriodId)
                .map(BscScorecard::getScoringMode)
                .orElse(null);
    }

    /**
     * Điểm chính thức = bsc_score khi kỳ ở chế độ OFFICIAL và có điểm BSC; ngược lại giữ system_score.
     * Thuần chọn field — KHÔNG tính lại gì, nên đổi SHADOW↔OFFICIAL không cần recompute.
     */
    public Double resolveOfficialScore(Double systemScore, Double bscScore, BscScoringMode mode) {
        if (mode == BscScoringMode.OFFICIAL && bscScore != null) return bscScore;
        return systemScore;
    }

    // ============================================================
    // Dashboard mức tổ chức (GĐ2)
    // ============================================================

    @Transactional(readOnly = true)
    public BscDashboardResponse getDashboard(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));

        UUID periodId = scorecard.getKpiPeriod().getId();
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByKpiPeriodIdAndStatusIn(periodId, ACTIVE_STATUSES);
        boolean enableWaterfall = Boolean.TRUE.equals(scorecard.getOrganization().getEnableWaterfall());

        List<PerspectiveScoreResponse> perspectiveScores = new ArrayList<>();
        double weightedSum = 0.0, presentWeight = 0.0, totalWeight = 0.0;
        boolean zeroFill = scorecard.getEmptyPerspectivePolicy() == BscEmptyPerspectivePolicy.ZERO_FILL;

        for (BscScorecardPerspective sp : scorecard.getScorecardPerspectives()) {
            UUID pid = sp.getPerspective().getId();
            double weight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
            totalWeight += weight;

            double ratioWeightSum = 0.0, weightSum = 0.0;
            int kpiCount = 0;
            for (KpiCriteria kpi : kpis) {
                if (!achievementCalculator.countsTowardBscScore(kpi)) continue;
                UUID eff = effectivePerspectiveId(kpi);
                if (eff == null || !eff.equals(pid)) continue;
                kpiCount++;
                // targetUserId = null ⇒ tính toàn bộ submission của KPI (mức tổ chức)
                Double ratio = achievementCalculator.bscRatio(kpi, null, enableWaterfall);
                if (ratio == null) continue;
                ratioWeightSum += ratio * kpi.getWeight();
                weightSum += kpi.getWeight();
            }

            Double achievement = weightSum > 0 ? (ratioWeightSum / weightSum) * 100.0 : null;
            Double weightedScore = achievement != null ? (weight / 100.0) * achievement : null;
            if (achievement != null) {
                weightedSum += weight * achievement;
                presentWeight += weight;
            }

            perspectiveScores.add(PerspectiveScoreResponse.builder()
                    .perspectiveId(pid)
                    .code(sp.getPerspective().getCode())
                    .name(sp.getPerspective().getName())
                    .color(sp.getPerspective().getColor())
                    .weightPercentage(weight)
                    .kpiCount(kpiCount)
                    .achievementPercent(achievement)
                    .weightedScore(weightedScore)
                    .build());
        }

        Double overall = zeroFill
                ? (totalWeight > 0 ? weightedSum / totalWeight : null)
                : (presentWeight > 0 ? weightedSum / presentWeight : null);

        return BscDashboardResponse.builder()
                .scorecardId(scorecard.getId())
                .name(scorecard.getName())
                .vision(scorecard.getVision())
                .kpiPeriodId(periodId)
                .kpiPeriodName(scorecard.getKpiPeriod().getName())
                .scoringMode(scorecard.getScoringMode())
                .overallScore(overall)
                .perspectives(perspectiveScores)
                .build();
    }

    /** Viễn cảnh hiệu lực của KPI: ưu tiên gán trực tiếp (GĐ4 sẽ bổ sung suy từ Objective cha). */
    private UUID effectivePerspectiveId(KpiCriteria kpi) {
        if (kpi.getPerspective() != null) return kpi.getPerspective().getId();
        return null;
    }
}
