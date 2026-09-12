package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.RankingResponses.*;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.CycleUnitEvaluationRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm biểu đồ XẾP HẠNG và SO SÁNH.
 *
 * <p>Phạm vi lấy từ {@link StatsTierResolver}, phân giải một lần đầu mỗi phương thức.
 */
@Service
@RequiredArgsConstructor
public class RankingAnalyticsService {

    private final StatsTierResolver tierResolver;
    private final EvaluationRepository evaluationRepository;
    private final CycleUnitEvaluationRepository cycleUnitEvaluationRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final OrganizationRepository organizationRepository;

    // ============================================================
    // C2 - Chênh lệch điểm so với trung bình
    // ============================================================

    @Transactional(readOnly = true)
    public DeviationResponse getScoreDeviation(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);

        if (scope.isEmpty()) {
            return DeviationResponse.builder()
                    .rows(List.of()).baseline(0.0)
                    .baselineLabel("So với trung bình phạm vi đang xem").unit("điểm")
                    .anonymized(scope.anonymize()).build();
        }

        List<Object[]> raw = evaluationRepository.avgScoreByUser(scope.unitIds(), scope.periodIds());
        double baseline = raw.stream()
                .map(r -> dbl(r[3])).filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue).average().orElse(0);

        boolean anonymize = scope.anonymize();
        List<DeviationRow> rows = new ArrayList<>();
        for (Object[] r : raw) {
            Double score = dbl(r[3]);
            if (score == null) continue;
            UUID userId = (UUID) r[0];
            boolean self = userId != null && userId.equals(scope.userId());
            boolean hide = anonymize && !self;
            rows.add(DeviationRow.builder()
                    .id(hide ? null : userId)
                    // Cấp SELF vẫn thấy mình đứng đâu trong dải, nhưng người khác chỉ còn là một
                    // vạch không tên — đủ để định vị mà không lộ điểm của đồng nghiệp.
                    .name(hide ? "—" : (String) r[1])
                    .subText(hide ? null : (String) r[2])
                    .deviation(round1(score - baseline))
                    .score(hide ? null : round1(score))
                    .isSelf(self)
                    .build());
        }
        rows.sort(Comparator.comparingDouble(x -> -x.getDeviation()));

        return DeviationResponse.builder()
                .rows(rows)
                .baseline(round1(baseline))
                .baselineLabel("So với trung bình phạm vi đang xem")
                .unit("điểm")
                .anonymized(anonymize)
                .build();
    }

    // ============================================================
    // C3 - Tự đánh giá vs quản lý đánh giá
    // ============================================================

    @Transactional(readOnly = true)
    public SelfVsManagerResponse getSelfVsManager(UUID orgUnitId, Collection<UUID> periodIds, UUID cycleId) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        double axisMax = resolveMaxScore(scope.orgId());

        UUID effCycle = cycleId != null ? cycleId : latestCycleId(scope.orgId());
        if (effCycle == null || scope.unitIds().isEmpty() || scope.anonymize()) {
            return SelfVsManagerResponse.builder().rows(List.of()).axisMax(axisMax).build();
        }

        List<SelfVsManagerRow> rows = new ArrayList<>();
        double gapSum = 0;
        int gapCount = 0;
        for (Object[] r : cycleUnitEvaluationRepository.scoresByCycleAndUnits(effCycle, scope.unitIds())) {
            Double self = dbl(r[2]);
            Double mgr = dbl(r[3]);
            // Chỉ có ý nghĩa khi CẢ HAI đều đã chấm; thiếu một bên thì không có chênh lệch nào để nói.
            if (self == null || mgr == null) continue;
            double gap = self - mgr;
            rows.add(SelfVsManagerRow.builder()
                    .orgUnitId((UUID) r[0])
                    .name((String) r[1])
                    .selfScore(round1(self))
                    .managerScore(round1(mgr))
                    .gap(round1(gap))
                    .memberCount(r[6] == null ? 0 : ((Number) r[6]).intValue())
                    .build());
            gapSum += gap;
            gapCount++;
        }
        rows.sort(Comparator.comparingDouble(x -> -Math.abs(x.getGap())));

        return SelfVsManagerResponse.builder()
                .rows(rows)
                .axisMax(axisMax)
                .averageGap(gapCount == 0 ? null : round1(gapSum / gapCount))
                .build();
    }

    // ============================================================
    // K2 - Biến động thứ hạng giữa hai kỳ
    // ============================================================

    @Transactional(readOnly = true)
    public RankDeltaResponse getRankDelta(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        double axisMax = resolveMaxScore(scope.orgId());

        if (scope.orgId() == null || scope.unitIds().isEmpty() || scope.anonymize()) {
            return RankDeltaResponse.builder()
                    .rows(List.of()).axisMax(axisMax).comparable(false).build();
        }

        // Hai kỳ gần nhất của tổ chức: so kỳ này với kỳ ngay trước là câu hỏi thường gặp nhất.
        List<KpiCycle> cycles = kpiCycleRepository.findByOrganizationIdOrderByStartDateDesc(scope.orgId());
        if (cycles.size() < 2) {
            return RankDeltaResponse.builder()
                    .rows(List.of()).axisMax(axisMax).comparable(false)
                    .currentCycleName(cycles.isEmpty() ? null : cycles.get(0).getName())
                    .build();
        }
        KpiCycle current = cycles.get(0);
        KpiCycle previous = cycles.get(1);

        Map<UUID, Double> currentScores = finalScores(current.getId(), scope.unitIds());
        Map<UUID, Double> previousScores = finalScores(previous.getId(), scope.unitIds());
        Map<UUID, String> names = unitNames(current.getId(), previous.getId(), scope.unitIds());

        Map<UUID, Integer> currentRanks = ranksOf(currentScores);
        Map<UUID, Integer> previousRanks = ranksOf(previousScores);

        List<RankDeltaRow> rows = new ArrayList<>();
        for (Map.Entry<UUID, Double> e : currentScores.entrySet()) {
            UUID unitId = e.getKey();
            Integer prevRank = previousRanks.get(unitId);
            Double prevScore = previousScores.get(unitId);
            rows.add(RankDeltaRow.builder()
                    .orgUnitId(unitId)
                    .name(names.getOrDefault(unitId, "—"))
                    .score(round1(e.getValue()))
                    .currentRank(currentRanks.get(unitId))
                    // Thứ hạng nhỏ hơn là tốt hơn, nên thăng hạng = prev - current > 0.
                    .rankDelta(prevRank == null ? null : prevRank - currentRanks.get(unitId))
                    .previousRank(prevRank)
                    .scoreDelta(prevScore == null ? null : round1(e.getValue() - prevScore))
                    .build());
        }
        rows.sort(Comparator.comparing(RankDeltaRow::getCurrentRank));

        return RankDeltaResponse.builder()
                .rows(rows)
                .currentCycleName(current.getName())
                .previousCycleName(previous.getName())
                .axisMax(axisMax)
                .comparable(true)
                .build();
    }

    /** Điểm chốt của mỗi đơn vị trong một kỳ: ưu tiên điểm quản lý, thiếu thì lấy điểm tự chấm. */
    private Map<UUID, Double> finalScores(UUID cycleId, Collection<UUID> unitIds) {
        Map<UUID, Double> out = new HashMap<>();
        for (Object[] r : cycleUnitEvaluationRepository.scoresByCycleAndUnits(cycleId, unitIds)) {
            Double mgr = dbl(r[3]);
            Double self = dbl(r[2]);
            Double score = mgr != null ? mgr : self;
            if (score != null) out.put((UUID) r[0], score);
        }
        return out;
    }

    private Map<UUID, String> unitNames(UUID cycleA, UUID cycleB, Collection<UUID> unitIds) {
        Map<UUID, String> out = new HashMap<>();
        for (UUID cycle : List.of(cycleA, cycleB)) {
            for (Object[] r : cycleUnitEvaluationRepository.scoresByCycleAndUnits(cycle, unitIds)) {
                out.putIfAbsent((UUID) r[0], (String) r[1]);
            }
        }
        return out;
    }

    /** Xếp hạng 1..n theo điểm giảm dần. */
    private static Map<UUID, Integer> ranksOf(Map<UUID, Double> scores) {
        List<Map.Entry<UUID, Double>> sorted = new ArrayList<>(scores.entrySet());
        sorted.sort(Comparator.comparingDouble(e -> -e.getValue()));
        Map<UUID, Integer> ranks = new HashMap<>();
        for (int i = 0; i < sorted.size(); i++) ranks.put(sorted.get(i).getKey(), i + 1);
        return ranks;
    }

    private UUID latestCycleId(UUID orgId) {
        if (orgId == null) return null;
        List<KpiCycle> cycles = kpiCycleRepository.findByOrganizationIdOrderByStartDateDesc(orgId);
        return cycles.isEmpty() ? null : cycles.get(0).getId();
    }

    private double resolveMaxScore(UUID orgId) {
        if (orgId == null) return 100.0;
        Organization org = organizationRepository.findById(orgId).orElse(null);
        Double max = org != null ? org.getEvaluationMaxScore() : null;
        return max != null && max > 0 ? max : 100.0;
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
