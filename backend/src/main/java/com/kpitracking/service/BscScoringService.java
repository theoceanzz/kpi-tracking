package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.BscDashboardResponse;
import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Tính điểm BSC.
 * GĐ2: dashboard mức tổ chức — điểm đạt trung bình có trọng số từng viễn cảnh cho một thẻ điểm.
 * (Tích hợp điểm cá nhân vào Evaluation làm ở GĐ3.)
 */
@Service
@RequiredArgsConstructor
public class BscScoringService {

    private final BscScorecardRepository scorecardRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository submissionRepository;

    private static final List<KpiStatus> ACTIVE_STATUSES = Arrays.asList(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);

    @Transactional(readOnly = true)
    public BscDashboardResponse getDashboard(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));

        UUID periodId = scorecard.getKpiPeriod().getId();
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByKpiPeriodIdAndStatusIn(periodId, ACTIVE_STATUSES);

        List<PerspectiveScoreResponse> perspectiveScores = new ArrayList<>();
        double weightedSum = 0.0;      // Σ(weight × achievement)
        double presentWeight = 0.0;    // Σ(weight) của viễn cảnh có KPI (RENORMALIZE)
        double totalWeight = 0.0;      // Σ(weight) toàn bộ (ZERO_FILL)
        boolean zeroFill = scorecard.getEmptyPerspectivePolicy() == BscEmptyPerspectivePolicy.ZERO_FILL;

        for (BscScorecardPerspective sp : scorecard.getScorecardPerspectives()) {
            UUID pid = sp.getPerspective().getId();
            double weight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
            totalWeight += weight;

            // KPI định lượng thuộc viễn cảnh này (bỏ KPI thưởng và KPI cha phân rã)
            double ratioWeightSum = 0.0;
            double weightSum = 0.0;
            int kpiCount = 0;
            for (KpiCriteria kpi : kpis) {
                UUID eff = effectivePerspectiveId(kpi);
                if (eff == null || !eff.equals(pid)) continue;
                kpiCount++;
                if (kpi.getKpiType() == KpiType.QUALITATIVE) continue;
                if (isDecompositionParent(kpi)) continue;
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                if (kpi.getTargetValue() == null || kpi.getTargetValue() <= 0 || kpi.getWeight() == null) continue;

                double ratio = kpiRatio(kpi);
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

        Double overall;
        if (zeroFill) {
            overall = totalWeight > 0 ? weightedSum / totalWeight : null;
        } else {
            overall = presentWeight > 0 ? weightedSum / presentWeight : null;
        }

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

    private boolean isDecompositionParent(KpiCriteria kpi) {
        return kpi.getChildren() != null && kpi.getChildren().stream()
                .anyMatch(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION);
    }

    /** Tỉ lệ đạt của 1 KPI định lượng (0..1.5), tính từ tổng actualValue của các submission đã duyệt. */
    private double kpiRatio(KpiCriteria kpi) {
        if (kpi.getCompensatedAchievementPercent() != null) {
            return Math.min(1.5, kpi.getCompensatedAchievementPercent() / 100.0);
        }
        double actual = submissionRepository.findByKpiCriteriaIdAndDeletedAtIsNull(kpi.getId()).stream()
                .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();
        double target = kpi.getTargetValue();
        boolean inverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double ratio = inverse ? Math.max(0.0, 2.0 - (actual / target)) : actual / target;
        return Math.min(ratio, 1.5);
    }
}
