package com.kpitracking.service;

import com.kpitracking.dto.response.stats.BscAnalyticsResponses.*;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import com.kpitracking.util.BscPerspectiveResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Thống kê BSC scope theo cây đơn vị + kỳ — cung cấp cho tab "Viễn cảnh (BSC)" ở trang Thống kê.
 *
 * <p>Nguyên tắc: GỘP điểm ĐÃ LƯU ({@code evaluations.bsc_score} + {@code evaluation_perspective_scores}),
 * KHÔNG tính lại. Vì trọng số BSC đóng băng theo kỳ và {@code weighted_score} đã cố định lúc chấm,
 * nên số liệu tự khớp với chỉ số "hiệu suất theo đánh giá" và không phá vỡ nguyên tắc mỗi kỳ đóng
 * băng chính sách riêng.
 *
 * <p>Scope tái dùng cách {@code OrgUnitKpiAnalyticsService} phân giải subtree; cửa sổ kỳ do
 * {@code AnalyticsPeriodHelper} clamp ở tầng controller.
 */
@Service
@RequiredArgsConstructor
public class BscAnalyticsService {

    private final AnalyticsScopeResolver scopeResolver;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final EvaluationRepository evaluationRepository;
    private final EvaluationPerspectiveScoreRepository perspectiveScoreRepository;
    private final KpiAchievementCalculator achievementCalculator;
    private final BscScoringService bscScoringService;

    /** Cùng tập trạng thái KPI được tính điểm BSC như {@link BscScoringService}. */
    private static final List<KpiStatus> ACTIVE_STATUSES = Arrays.asList(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);

    // ============================================================
    // 1) Cân bằng viễn cảnh (radar + thẻ chỉ số)
    // ============================================================

    @Transactional(readOnly = true)
    public BalanceResponse getBalance(UUID orgUnitId, Collection<UUID> periodIds) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        if (s.isEmpty()) return emptyBalance();

        List<PerspectivePoint> perspectives = new ArrayList<>();
        String strongest = null, weakest = null;
        Double strongestScore = null, weakestScore = null;
        for (Object[] r : perspectiveScoreRepository.aggregateByPerspective(s.unitIds(), s.periodIds())) {
            Double avg = dbl(r[5]);
            PerspectivePoint p = PerspectivePoint.builder()
                    .perspectiveId((UUID) r[0])
                    .code((String) r[1])
                    .name((String) r[2])
                    .color((String) r[3])
                    .displayOrder(intg(r[4]))
                    .averageScore(avg)
                    .weightedScore(dbl(r[6]))
                    .kpiCount(r[7] == null ? 0 : ((Number) r[7]).intValue())
                    .weightPercentage(dbl(r[8]))
                    .build();
            perspectives.add(p);
            if (avg != null) {
                if (strongestScore == null || avg > strongestScore) { strongestScore = avg; strongest = p.getName(); }
                if (weakestScore == null || avg < weakestScore) { weakestScore = avg; weakest = p.getName(); }
            }
        }

        Object[] overall = firstRow(evaluationRepository.bscOverall(s.unitIds(), s.periodIds()));
        Double avgBsc = overall != null ? dbl(overall[0]) : null;
        Double avgSystem = overall != null ? dbl(overall[1]) : null;
        int evalCount = overall != null && overall[2] != null ? ((Number) overall[2]).intValue() : 0;

        Coverage cov = computeCoverage(s.periodIds());

        return BalanceResponse.builder()
                .averageBscScore(avgBsc)
                .averageSystemScore(avgSystem)
                .evaluationCount(evalCount)
                .scoringMode(resolveScoringMode(s.orgId(), s.periodIds()))
                .strongestPerspective(strongest)
                .strongestScore(strongestScore)
                .weakestPerspective(weakest)
                .weakestScore(weakestScore)
                .coveragePercent(cov.percent)
                .mappedKpiCount(cov.mapped)
                .unmappedKpiCount(cov.unmapped)
                .unmappedKpiNames(cov.names)
                .perspectives(perspectives)
                .build();
    }

    private BalanceResponse emptyBalance() {
        return BalanceResponse.builder()
                .evaluationCount(0)
                .coveragePercent(100.0).mappedKpiCount(0).unmappedKpiCount(0)
                .unmappedKpiNames(Collections.emptyList())
                .perspectives(Collections.emptyList())
                .build();
    }

    // ============================================================
    // 2) Xu hướng theo kỳ (mỗi viễn cảnh một series + đường tổng BSC)
    // ============================================================

    @Transactional(readOnly = true)
    public TrendResponse getTrend(UUID orgUnitId, Collection<UUID> periodIds, String groupBy) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        if (s.isEmpty()) return new TrendResponse(Collections.emptyList(), Collections.emptyList());

        // Mốc = kỳ (BSC gắn chặt với kỳ). bscOverallByPeriod đã ORDER BY startDate.
        Map<UUID, TrendPointAcc> byPeriod = new LinkedHashMap<>();
        for (Object[] r : evaluationRepository.bscOverallByPeriod(s.unitIds(), s.periodIds())) {
            UUID pid = (UUID) r[0];
            byPeriod.put(pid, new TrendPointAcc((String) r[1], dbl(r[3])));
        }

        Map<UUID, PerspectiveMeta> metas = new LinkedHashMap<>();
        for (Object[] r : perspectiveScoreRepository.aggregateByPeriodAndPerspective(s.unitIds(), s.periodIds())) {
            UUID periodId = (UUID) r[0];
            UUID persId = (UUID) r[3];
            metas.putIfAbsent(persId, PerspectiveMeta.builder()
                    .id(persId).name((String) r[4]).color((String) r[5]).displayOrder(intg(r[6])).build());
            TrendPointAcc acc = byPeriod.get(periodId);
            if (acc == null) { acc = new TrendPointAcc((String) r[1], null); byPeriod.put(periodId, acc); }
            Double avg = dbl(r[7]);
            if (avg != null) acc.values.put(persId.toString(), round1(avg));
        }

        List<TrendPoint> points = byPeriod.values().stream()
                .map(a -> TrendPoint.builder().label(a.label).overall(round1(a.overall)).values(a.values).build())
                .collect(Collectors.toList());
        List<PerspectiveMeta> orderedMetas = metas.values().stream()
                .sorted(java.util.Comparator.comparing(m -> m.getDisplayOrder() == null ? 0 : m.getDisplayOrder()))
                .collect(Collectors.toList());
        return new TrendResponse(orderedMetas, points);
    }

    private static class TrendPointAcc {
        final String label; final Double overall; final Map<String, Double> values = new LinkedHashMap<>();
        TrendPointAcc(String label, Double overall) { this.label = label; this.overall = overall; }
    }

    // ============================================================
    // 3) So sánh viễn cảnh giữa các đơn vị
    // ============================================================

    @Transactional(readOnly = true)
    public UnitComparisonResponse getUnitComparison(UUID orgUnitId, Collection<UUID> periodIds) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        if (s.isEmpty()) return new UnitComparisonResponse(Collections.emptyList(), Collections.emptyList());

        Map<UUID, UnitRowAcc> byUnit = new LinkedHashMap<>();
        for (Object[] r : evaluationRepository.bscOverallByUnit(s.unitIds(), s.periodIds())) { // ORDER BY avgBsc DESC
            UUID uid = (UUID) r[0];
            byUnit.put(uid, new UnitRowAcc((String) r[1], dbl(r[2]), dbl(r[3]),
                    r[4] == null ? 0 : ((Number) r[4]).intValue()));
        }

        Map<UUID, PerspectiveMeta> metas = new LinkedHashMap<>();
        for (Object[] r : perspectiveScoreRepository.aggregateByUnitAndPerspective(s.unitIds(), s.periodIds())) {
            UUID uid = (UUID) r[0];
            UUID persId = (UUID) r[2];
            metas.putIfAbsent(persId, PerspectiveMeta.builder()
                    .id(persId).name((String) r[3]).color((String) r[4]).displayOrder(intg(r[5])).build());
            UnitRowAcc acc = byUnit.get(uid);
            if (acc == null) { acc = new UnitRowAcc((String) r[1], null, null, 0); byUnit.put(uid, acc); }
            Double avg = dbl(r[6]);
            if (avg != null) acc.values.put(persId.toString(), round1(avg));
        }

        List<UnitRow> units = byUnit.entrySet().stream()
                .map(e -> UnitRow.builder()
                        .orgUnitId(e.getKey())
                        .orgUnitName(e.getValue().name)
                        .overallBsc(round1(e.getValue().bsc))
                        .overallSystem(round1(e.getValue().system))
                        .evaluationCount(e.getValue().count)
                        .values(e.getValue().values)
                        .build())
                .collect(Collectors.toList());
        List<PerspectiveMeta> orderedMetas = metas.values().stream()
                .sorted(java.util.Comparator.comparing(m -> m.getDisplayOrder() == null ? 0 : m.getDisplayOrder()))
                .collect(Collectors.toList());
        return new UnitComparisonResponse(orderedMetas, units);
    }

    private static class UnitRowAcc {
        final String name; final Double bsc; final Double system; final int count;
        final Map<String, Double> values = new LinkedHashMap<>();
        UnitRowAcc(String name, Double bsc, Double system, int count) {
            this.name = name; this.bsc = bsc; this.system = system; this.count = count;
        }
    }

    // ============================================================
    // 4) Kiểm chứng SHADOW — bsc_score vs system_score
    // ============================================================

    @Transactional(readOnly = true)
    public BscVsSystemResponse getBscVsSystem(UUID orgUnitId, Collection<UUID> periodIds, String level) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        boolean member = "MEMBER".equalsIgnoreCase(level);
        String lvl = member ? "MEMBER" : "UNIT";
        if (s.isEmpty()) return new BscVsSystemResponse(lvl, null, Collections.emptyList());

        List<BscVsSystemRow> rows = new ArrayList<>();
        if (member) {
            for (Object[] r : evaluationRepository.bscOverallByUser(s.unitIds(), s.periodIds())) {
                rows.add(BscVsSystemRow.builder()
                        .id((UUID) r[0]).name((String) r[1])
                        .bscScore(round1(dbl(r[3]))).systemScore(round1(dbl(r[4])))
                        .evaluationCount(r[5] == null ? 0 : ((Number) r[5]).intValue())
                        .build());
            }
            // sắp xếp theo độ lệch |bsc - system| giảm dần (bất thường lên đầu để HR soi)
            rows.sort((a, b) -> Double.compare(gap(b), gap(a)));
        } else {
            for (Object[] r : evaluationRepository.bscOverallByUnit(s.unitIds(), s.periodIds())) {
                rows.add(BscVsSystemRow.builder()
                        .id((UUID) r[0]).name((String) r[1])
                        .bscScore(round1(dbl(r[2]))).systemScore(round1(dbl(r[3])))
                        .evaluationCount(r[4] == null ? 0 : ((Number) r[4]).intValue())
                        .build());
            }
        }
        return new BscVsSystemResponse(lvl, resolveScoringMode(s.orgId(), s.periodIds()), rows);
    }

    private static double gap(BscVsSystemRow r) {
        if (r.getBscScore() == null || r.getSystemScore() == null) return -1;
        return Math.abs(r.getBscScore() - r.getSystemScore());
    }

    // ============================================================
    // 5) Xếp hạng nhân sự theo điểm BSC + breakdown viễn cảnh
    // ============================================================

    @Transactional(readOnly = true)
    public RankingResponse getRankings(UUID orgUnitId, Collection<UUID> periodIds,
                                       String sortBy, String sortDir, int page, int size) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        if (s.isEmpty()) return emptyRanking(page, size);

        // breakdown viễn cảnh theo nhân sự
        Map<UUID, Map<String, Double>> breakdown = new LinkedHashMap<>();
        Map<UUID, PerspectiveMeta> metas = new LinkedHashMap<>();
        for (Object[] r : perspectiveScoreRepository.aggregateByUserAndPerspective(s.unitIds(), s.periodIds())) {
            UUID uid = (UUID) r[0];
            UUID persId = (UUID) r[1];
            metas.putIfAbsent(persId, PerspectiveMeta.builder()
                    .id(persId).name((String) r[2]).color((String) r[3]).displayOrder(intg(r[4])).build());
            Double avg = dbl(r[5]);
            if (avg != null) breakdown.computeIfAbsent(uid, k -> new LinkedHashMap<>()).put(persId.toString(), round1(avg));
        }

        List<RankingRow> all = new ArrayList<>();
        for (Object[] r : evaluationRepository.bscOverallByUser(s.unitIds(), s.periodIds())) {
            UUID uid = (UUID) r[0];
            all.add(RankingRow.builder()
                    .userId(uid).fullName((String) r[1]).email((String) r[2])
                    .bscScore(round1(dbl(r[3]))).systemScore(round1(dbl(r[4])))
                    .evaluationCount(r[5] == null ? 0 : ((Number) r[5]).intValue())
                    .perspectiveScores(breakdown.getOrDefault(uid, Collections.emptyMap()))
                    .build());
        }

        boolean asc = "asc".equalsIgnoreCase(sortDir);
        java.util.function.Function<RankingRow, Double> key =
                "systemScore".equalsIgnoreCase(sortBy) ? RankingRow::getSystemScore : RankingRow::getBscScore;
        all.sort((a, b) -> {
            Double va = key.apply(a), vb = key.apply(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;   // null luôn xuống cuối
            if (vb == null) return -1;
            return asc ? Double.compare(va, vb) : Double.compare(vb, va);
        });

        List<PerspectiveMeta> orderedMetas = metas.values().stream()
                .sorted(java.util.Comparator.comparing(m -> m.getDisplayOrder() == null ? 0 : m.getDisplayOrder()))
                .collect(Collectors.toList());

        long total = all.size();
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        List<RankingRow> content = all.subList(from, to);
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
        return RankingResponse.builder()
                .perspectives(orderedMetas)
                .content(content)
                .page(page).size(size).totalElements(total).totalPages(totalPages)
                .first(page == 0).last(page >= totalPages - 1)
                .build();
    }

    private RankingResponse emptyRanking(int page, int size) {
        return RankingResponse.builder()
                .perspectives(Collections.emptyList()).content(Collections.emptyList())
                .page(page).size(size).totalElements(0).totalPages(0).first(true).last(true)
                .build();
    }

    // ============================================================
    // Coverage (KPI đã gán viễn cảnh) — data-quality guard
    // ============================================================

    private record Coverage(Double percent, int mapped, int unmapped, List<String> names) {}

    /**
     * % KPI tính điểm BSC đã được gán viễn cảnh (hiệu lực: trực tiếp hoặc suy từ Objective cha).
     * Dùng CÙNG tập KPI & quy tắc "đủ điều kiện tính điểm" như {@link BscScoringService} — chỉ ĐẾM,
     * không tính lại điểm. Ở mức tổ chức + kỳ (viễn cảnh vốn là cấu hình org-wide).
     */
    private Coverage computeCoverage(Collection<UUID> periodIds) {
        int total = 0, unmapped = 0;
        List<String> names = new ArrayList<>();
        for (UUID pid : periodIds) {
            for (KpiCriteria kpi : kpiCriteriaRepository.findByKpiPeriodIdAndStatusIn(pid, ACTIVE_STATUSES)) {
                if (!achievementCalculator.countsTowardBscScore(kpi)) continue;
                total++;
                if (BscPerspectiveResolver.effectivePerspectiveId(kpi) == null) {
                    unmapped++;
                    if (names.size() < 50) names.add(kpi.getName());
                }
            }
        }
        Double percent = total > 0 ? round1((total - unmapped) * 100.0 / total) : 100.0;
        return new Coverage(percent, total - unmapped, unmapped, names);
    }

    /** SHADOW nếu bất kỳ kỳ nào đang chạy song song; OFFICIAL nếu có kỳ chính thức; null nếu không kỳ nào có thẻ điểm. */
    private String resolveScoringMode(UUID orgId, Collection<UUID> periodIds) {
        if (orgId == null) return null;
        boolean shadow = false, official = false;
        for (UUID pid : periodIds) {
            // Analytics mức org: lấy chế độ của thẻ điểm MẶC ĐỊNH toàn org (org_unit = NULL).
            BscScoringMode mode = bscScoringService.getScoringMode(null, orgId, pid);
            if (mode == BscScoringMode.SHADOW) shadow = true;
            else if (mode == BscScoringMode.OFFICIAL) official = true;
        }
        return shadow ? "SHADOW" : official ? "OFFICIAL" : null;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Object[] firstRow(List<Object[]> rows) {
        return rows == null || rows.isEmpty() ? null : rows.get(0);
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Integer intg(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
