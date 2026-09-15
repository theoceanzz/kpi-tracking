package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.*;
import com.kpitracking.entity.BscFixedPerspectiveEntity;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.repository.BscFixedPerspectiveRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tổng quan BSC theo mô hình THẺ ĐIỂM cho tab "Hạng mục BSC": cây Công ty → Đơn vị kèm %đạt của
 * đợt, mức đạt từng chỉ tiêu, độ phủ phân rã, hạng mục chặn, xu hướng %đạt qua các đợt.
 *
 * <p>Nguyên tắc: đọc {@code bsc_unit_results} ĐÃ TÍNH, không tính lại. Đợt nào chưa recompute thì
 * trả {@code hasResult=false} — tab hiện đúng chỗ trống thay vì một con số tự bịa.
 *
 * <p>"Thẻ gốc" của phạm vi: có {@code orgUnitId} thì là thẻ ĐƠN VỊ áp cho đơn vị đó trong đợt
 * (không có thì lùi về thẻ công ty), không thì là thẻ công ty của đợt.
 */
@Service
@RequiredArgsConstructor
public class BscOverviewService {

    private final AnalyticsScopeResolver scopeResolver;
    private final BscScorecardRepository scorecardRepository;
    private final BscScorecardPerspectiveRepository itemRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final BscUnitResultItemRepository unitResultItemRepository;
    private final BscFixedPerspectiveRepository fixedPerspectiveRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final BscTreeService treeService;

    // ============================================================
    // Thẻ số liệu
    // ============================================================

    @Transactional(readOnly = true)
    public OverviewResponse overview(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        if (orgId == null) return OverviewResponse.builder().unitStatusCounts(Map.of()).coverage(emptyCoverage()).build();

        KpiPeriod period = pickPeriod(orgId, periodIds);
        if (period == null) return OverviewResponse.builder().unitStatusCounts(Map.of()).coverage(emptyCoverage()).build();

        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        OverviewResponse.OverviewResponseBuilder b = OverviewResponse.builder()
                .periodId(period.getId()).periodName(period.getName())
                .unitStatusCounts(new LinkedHashMap<>())
                .coverage(emptyCoverage());
        if (root == null) return b.build();

        Map<UUID, BscUnitResult> results = resultsByScorecard(orgId, period.getId());
        List<BscScorecard> subtree = subtree(root);
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(root.getId());
        BscUnitResult rootResult = results.get(root.getId());

        Map<String, Integer> statusCounts = new LinkedHashMap<>();
        int withResult = 0, gateOk = 0, gateFail = 0;
        for (BscScorecard s : subtree) {
            if (s.getId().equals(root.getId())) continue;
            statusCounts.merge(s.getStatus() == null ? "DRAFT" : s.getStatus().name(), 1, Integer::sum);
            BscUnitResult r = results.get(s.getId());
            if (r == null) continue;
            withResult++;
            if (Boolean.FALSE.equals(r.getGatePassed())) gateFail++;
            else gateOk++;
        }

        ScorecardCoverageResponse cov = treeService.coverage(root.getId());

        return b.scorecardId(root.getId()).scorecardName(root.getName())
                .orgUnitName(unitNameOf(root))
                .level(root.getLevel()).status(root.getStatus()).scoringMode(root.getScoringMode())
                .achievementPercent(rootResult != null ? rootResult.getAchievementPercent() : null)
                .resultStatus(rootResult != null ? rootResult.getStatus() : null)
                .gatePassed(rootResult != null ? rootResult.getGatePassed() : null)
                .gateFailedItems(rootResult != null ? rootResult.getGateFailedItems() : null)
                .itemCount(rows.size())
                .unitScorecardCount(subtree.size() - 1)
                .unitStatusCounts(statusCounts)
                .unitsWithResult(withResult).unitsGatePassed(gateOk).unitsGateFailed(gateFail)
                .coverage(CoverageCounts.builder()
                        .total(cov.getItems() == null ? 0 : cov.getItems().size())
                        .notCascaded(cov.getNotCascadedCount()).under(cov.getUnderCount())
                        .ok(cov.getOkCount()).over(cov.getOverCount()).build())
                .build();
    }

    // ============================================================
    // Cây thẻ điểm trải phẳng + %đạt
    // ============================================================

    @Transactional(readOnly = true)
    public List<UnitAttainmentRow> unitAttainment(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        if (orgId == null) return List.of();
        KpiPeriod period = pickPeriod(orgId, periodIds);
        if (period == null) return List.of();
        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        if (root == null) return List.of();

        Map<UUID, BscUnitResult> results = resultsByScorecard(orgId, period.getId());
        Map<UUID, List<BscScorecard>> byParent = childrenIndex(orgId);
        List<UnitAttainmentRow> out = new ArrayList<>();
        walk(root, null, 0, byParent, results, out);
        return out;
    }

    private void walk(BscScorecard s, BscScorecard parent, int depth, Map<UUID, List<BscScorecard>> byParent,
                      Map<UUID, BscUnitResult> results, List<UnitAttainmentRow> out) {
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(s.getId());
        BscUnitResult r = results.get(s.getId());
        out.add(UnitAttainmentRow.builder()
                .scorecardId(s.getId()).name(s.getName()).orgUnitName(unitNameOf(s))
                .level(s.getLevel()).status(s.getStatus()).depth(depth)
                .parentScorecardName(parent != null ? parent.getName() : null)
                .achievementPercent(r != null ? r.getAchievementPercent() : null)
                .resultStatus(r != null ? r.getStatus() : null)
                .gatePassed(r != null ? r.getGatePassed() : null)
                .gateFailedItems(r != null ? r.getGateFailedItems() : null)
                .itemCount(rows.size())
                .assignedCount((int) rows.stream().filter(x -> x.getOrigin() == com.kpitracking.enums.BscItemOrigin.ASSIGNED).count())
                .gateCount((int) rows.stream().filter(x -> Boolean.TRUE.equals(x.getIsGate())).count())
                .totalWeight(rows.stream().mapToDouble(x -> x.getWeightPercentage() == null ? 0 : x.getWeightPercentage()).sum())
                .build());
        if (depth >= 20) return; // chặn cây vòng
        List<BscScorecard> kids = new ArrayList<>(byParent.getOrDefault(s.getId(), List.of()));
        kids.sort(Comparator.comparing(BscScorecard::getName, Comparator.nullsLast(String::compareTo)));
        for (BscScorecard k : kids) walk(k, s, depth + 1, byParent, results, out);
    }

    // ============================================================
    // Mức đạt từng chỉ tiêu (bullet)
    // ============================================================

    @Transactional(readOnly = true)
    public ItemAttainmentResponse itemAttainment(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        if (orgId == null) return ItemAttainmentResponse.builder().items(List.of()).build();
        KpiPeriod period = pickPeriod(orgId, periodIds);
        if (period == null) return ItemAttainmentResponse.builder().items(List.of()).build();
        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        ItemAttainmentResponse.ItemAttainmentResponseBuilder b = ItemAttainmentResponse.builder()
                .periodId(period.getId()).periodName(period.getName()).items(List.of());
        if (root == null) return b.build();

        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(root.getId(), period.getId()).orElse(null);
        Map<UUID, BscUnitResultItem> itemByRow = new HashMap<>();
        if (result != null) {
            for (BscUnitResultItem it : unitResultItemRepository.findByUnitResultId(result.getId())) {
                itemByRow.put(it.getScorecardPerspective().getId(), it);
            }
        }
        Map<BscFixedPerspective, PerspectiveRef> refs = perspectiveRefs(orgId);

        List<ItemRow> items = new ArrayList<>();
        for (BscScorecardPerspective row : itemRepository.findByScorecardIdOrderByDisplayOrderAsc(root.getId())) {
            BscUnitResultItem it = itemByRow.get(row.getId());
            BscFixedPerspective fp = row.getPerspective() != null ? row.getPerspective().getFixedPerspective() : null;
            PerspectiveRef ref = fp != null ? refs.get(fp) : null;
            Double target = row.getTargetValue() != null ? row.getTargetValue()
                    : row.getPerspective() != null ? row.getPerspective().getTargetValue() : null;
            Double minimum = row.getMinimumValue() != null ? row.getMinimumValue()
                    : row.getPerspective() != null ? row.getPerspective().getMinimumValue() : null;
            String unit = row.getUnit() != null ? row.getUnit()
                    : row.getPerspective() != null ? row.getPerspective().getUnit() : null;
            items.add(ItemRow.builder()
                    .scorecardPerspectiveId(row.getId())
                    .name(row.getPerspective() != null ? row.getPerspective().getName() : "Chỉ tiêu")
                    .color(row.getPerspective() != null && row.getPerspective().getColor() != null
                            ? row.getPerspective().getColor() : ref != null ? ref.getColor() : null)
                    .fixedPerspective(fp != null ? fp.name() : null)
                    .fixedPerspectiveName(ref != null ? ref.getName() : null)
                    .fixedPerspectiveColor(ref != null ? ref.getColor() : null)
                    .actualValue(it != null ? it.getActualValue() : null)
                    .targetValue(it != null && it.getTargetValue() != null ? it.getTargetValue() : target)
                    .minimumValue(minimum)
                    .unit(unit)
                    .achievementPercent(it != null ? it.getAchievementPercent() : null)
                    .weightPercentage(it != null && it.getWeightPercentage() != null ? it.getWeightPercentage() : row.getWeightPercentage())
                    .weightedScore(it != null ? it.getWeightedScore() : null)
                    .kpiCount(it != null ? it.getKpiCount() : null)
                    .isGate(Boolean.TRUE.equals(row.getIsGate()))
                    .gateMinPercent(row.getGateMinPercent())
                    .gatePassed(it != null ? it.getGatePassed() : null)
                    .measurementSource(it != null && it.getMeasurementSource() != null
                            ? it.getMeasurementSource().name()
                            : row.getMeasurementSource() != null ? row.getMeasurementSource().name() : null)
                    .origin(row.getOrigin() != null ? row.getOrigin().name() : null)
                    .parentScorecardName(row.getParentItem() != null && row.getParentItem().getScorecard() != null
                            ? row.getParentItem().getScorecard().getName() : null)
                    .hasResult(it != null)
                    .build());
        }

        return b.scorecardId(root.getId()).scorecardName(root.getName()).orgUnitName(unitNameOf(root))
                .achievementPercent(result != null ? result.getAchievementPercent() : null)
                .gatePassed(result != null ? result.getGatePassed() : null)
                .resultStatus(result != null ? result.getStatus() : null)
                .items(items)
                .build();
    }

    // ============================================================
    // Xu hướng %đạt qua các đợt
    // ============================================================

    @Transactional(readOnly = true)
    public AttainmentTrendResponse attainmentTrend(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        Map<BscFixedPerspective, PerspectiveRef> refs = orgId != null ? perspectiveRefs(orgId) : new EnumMap<>(BscFixedPerspective.class);
        AttainmentTrendResponse.AttainmentTrendResponseBuilder b = AttainmentTrendResponse.builder()
                .perspectives(new ArrayList<>(refs.values())).points(List.of());
        if (orgId == null) return b.build();

        List<KpiPeriod> periods = orderedPeriods(orgId, periodIds);
        List<TrendPoint> points = new ArrayList<>();
        for (KpiPeriod p : periods) {
            BscScorecard root = resolveRoot(orgId, orgUnitId, p.getId());
            TrendPoint.TrendPointBuilder tp = TrendPoint.builder().periodId(p.getId()).label(p.getName())
                    .byPerspective(new LinkedHashMap<>());
            if (root == null) { points.add(tp.build()); continue; }
            tp.scorecardId(root.getId());
            BscUnitResult r = unitResultRepository.findByScorecardIdAndKpiPeriodId(root.getId(), p.getId()).orElse(null);
            if (r == null) { points.add(tp.build()); continue; }

            // %đạt theo lĩnh vực = bình quân có trọng số của các chỉ tiêu thuộc lĩnh vực đó.
            Map<String, double[]> acc = new LinkedHashMap<>(); // code → [sum(w*a), sum(w)]
            for (BscUnitResultItem it : unitResultItemRepository.findByUnitResultId(r.getId())) {
                BscScorecardPerspective row = it.getScorecardPerspective();
                BscFixedPerspective fp = row != null && row.getPerspective() != null ? row.getPerspective().getFixedPerspective() : null;
                if (fp == null || it.getAchievementPercent() == null) continue;
                double w = it.getWeightPercentage() != null && it.getWeightPercentage() > 0 ? it.getWeightPercentage() : 1.0;
                double[] a = acc.computeIfAbsent(fp.name(), k -> new double[2]);
                a[0] += w * it.getAchievementPercent();
                a[1] += w;
            }
            Map<String, Double> byP = new LinkedHashMap<>();
            for (BscFixedPerspective fp : BscFixedPerspective.values()) {
                double[] a = acc.get(fp.name());
                if (a != null && a[1] > 0) byP.put(fp.name(), Math.round(a[0] / a[1] * 10.0) / 10.0);
            }
            points.add(tp.hasResult(true).achievementPercent(r.getAchievementPercent())
                    .gatePassed(r.getGatePassed()).byPerspective(byP).build());
        }
        return b.points(points).build();
    }

    // ============================================================
    // Độ phủ phân rã của thẻ gốc
    // ============================================================

    @Transactional(readOnly = true)
    public ScorecardCoverageResponse cascadeCoverage(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        if (orgId == null) return emptyCoverageResponse();
        KpiPeriod period = pickPeriod(orgId, periodIds);
        if (period == null) return emptyCoverageResponse();
        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        if (root == null) return emptyCoverageResponse();
        return treeService.coverage(root.getId());
    }

    // ============================================================
    // Helpers
    // ============================================================

    /**
     * Thẻ gốc của phạm vi trong một đợt: thẻ ĐƠN VỊ áp cho đơn vị được chọn (ưu tiên ACTIVE, rồi
     * mới nhất), nếu không có thì thẻ công ty / thẻ mặc định toàn tổ chức của đợt.
     */
    private BscScorecard resolveRoot(UUID orgId, UUID orgUnitId, UUID periodId) {
        if (orgUnitId != null) {
            BscScorecard unitCard = preferActive(scorecardRepository.findByOrgUnitAndPeriod(orgId, orgUnitId, periodId));
            if (unitCard != null) return unitCard;
        }
        BscScorecard company = preferActive(scorecardRepository.findCompanyByPeriod(orgId, periodId));
        if (company != null) return company;
        return preferActive(scorecardRepository.findDefaultByPeriod(orgId, periodId));
    }

    private static BscScorecard preferActive(List<BscScorecard> cards) {
        if (cards == null || cards.isEmpty()) return null;
        return cards.stream()
                .sorted(Comparator
                        .comparing((BscScorecard s) -> s.getStatus() == BscScorecardStatus.ACTIVE ? 0 : 1)
                        .thenComparing(s -> s.getCreatedAt() == null ? Instant.EPOCH : s.getCreatedAt(), Comparator.reverseOrder()))
                .findFirst().orElse(null);
    }

    /**
     * Đợt để soi cho các ô "một đợt": đợt MUỘN NHẤT trong lựa chọn (không chọn thì trong toàn tổ
     * chức) mà đã có kết quả BSC; không đợt nào có kết quả thì lấy đợt muộn nhất — để ô còn nói
     * được "đợt X chưa tính" thay vì trống trơn.
     */
    private KpiPeriod pickPeriod(UUID orgId, Collection<UUID> periodIds) {
        List<KpiPeriod> ordered = orderedPeriods(orgId, periodIds);
        if (ordered.isEmpty()) return null;
        for (int i = ordered.size() - 1; i >= 0; i--) {
            KpiPeriod p = ordered.get(i);
            if (!unitResultRepository.findByOrganizationAndPeriod(orgId, p.getId()).isEmpty()) return p;
        }
        return ordered.get(ordered.size() - 1);
    }

    /** Các đợt trong lựa chọn (hoặc cả tổ chức), sắp theo ngày bắt đầu tăng dần. */
    private List<KpiPeriod> orderedPeriods(UUID orgId, Collection<UUID> periodIds) {
        List<KpiPeriod> all = kpiPeriodRepository.findByOrganizationId(orgId);
        if (periodIds != null && !periodIds.isEmpty()) {
            Set<UUID> sel = new HashSet<>(periodIds);
            all = all.stream().filter(p -> sel.contains(p.getId())).collect(Collectors.toList());
        }
        all.sort(Comparator.comparing((KpiPeriod p) -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate())
                .thenComparing(p -> p.getName() == null ? "" : p.getName()));
        return all;
    }

    private Map<UUID, BscUnitResult> resultsByScorecard(UUID orgId, UUID periodId) {
        Map<UUID, BscUnitResult> out = new HashMap<>();
        for (BscUnitResult r : unitResultRepository.findByOrganizationAndPeriod(orgId, periodId)) {
            out.put(r.getScorecard().getId(), r);
        }
        return out;
    }

    private Map<UUID, List<BscScorecard>> childrenIndex(UUID orgId) {
        Map<UUID, List<BscScorecard>> byParent = new HashMap<>();
        for (BscScorecard s : scorecardRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)) {
            if (s.getParentScorecard() != null) {
                byParent.computeIfAbsent(s.getParentScorecard().getId(), k -> new ArrayList<>()).add(s);
            }
        }
        return byParent;
    }

    /** Thẻ gốc + mọi thẻ con cháu (BFS, chặn vòng). */
    private List<BscScorecard> subtree(BscScorecard root) {
        Map<UUID, List<BscScorecard>> byParent = childrenIndex(root.getOrganization().getId());
        List<BscScorecard> out = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        List<BscScorecard> queue = new ArrayList<>(List.of(root));
        while (!queue.isEmpty()) {
            BscScorecard s = queue.remove(0);
            if (!seen.add(s.getId())) continue;
            out.add(s);
            queue.addAll(byParent.getOrDefault(s.getId(), List.of()));
        }
        return out;
    }

    private Map<BscFixedPerspective, PerspectiveRef> perspectiveRefs(UUID orgId) {
        Map<String, BscFixedPerspectiveEntity> byCode = fixedPerspectiveRepository
                .findByOrganizationIdOrderByDisplayOrderAsc(orgId).stream()
                .collect(Collectors.toMap(BscFixedPerspectiveEntity::getCode, e -> e, (a, c) -> a));
        Map<BscFixedPerspective, PerspectiveRef> out = new EnumMap<>(BscFixedPerspective.class);
        for (BscFixedPerspective fp : BscFixedPerspective.values()) {
            BscFixedPerspectiveEntity e = byCode.get(fp.name());
            out.put(fp, PerspectiveRef.builder().code(fp.name())
                    .name(e != null && e.getName() != null ? e.getName() : fp.getDisplayName())
                    .color(e != null && e.getColor() != null ? e.getColor() : fp.getColor())
                    .build());
        }
        return out;
    }

    private static String unitNameOf(BscScorecard s) {
        if (s.getLevel() == BscScorecardLevel.COMPANY || s.getOrgUnits() == null || s.getOrgUnits().isEmpty()) return null;
        return s.getOrgUnits().stream().map(OrgUnit::getName).collect(Collectors.joining(", "));
    }

    private static CoverageCounts emptyCoverage() {
        return CoverageCounts.builder().build();
    }

    private static ScorecardCoverageResponse emptyCoverageResponse() {
        return ScorecardCoverageResponse.builder().items(List.of()).build();
    }
}
