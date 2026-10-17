package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.CoverageChildResponse;
import com.kpitracking.dto.response.bsc.CoverageItemResponse;
import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.stats.BscGoalGraphResponses.*;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.repository.BscFixedPerspectiveRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.analytics.AnalyticsKpiMetrics;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Đồ thị mục tiêu BSC cho ba cách xem của BRD: bản đồ chiến lược, cây liên kết mục tiêu, xương cá.
 *
 * <p><b>Một nguồn cho cả ba.</b> BRD yêu cầu như vậy, và đó cũng là cách duy nhất để ba hình không
 * nói ba chuyện: cả ba đọc cùng một payload, khác nhau chỉ ở cách vẽ.
 *
 * <p><b>Không tính lại gì.</b> %đạt đọc từ {@code bsc_unit_results} đã "Tính lại"; thẻ điểm gốc và
 * đợt chọn theo đúng {@link BscOverviewService}; %đạt của từng KPI đi qua {@link AnalyticsKpiMetrics}
 * nên con số trong bảng drill-down trùng khít con số đã sinh ra điểm BSC.
 *
 * <p><b>Giới hạn của mô hình dữ liệu</b> (nói rõ để không ai chờ đợi sai): quan hệ giữa các chỉ
 * tiêu chỉ có MỘT cha ({@code parentItemId}) và bốn loại liên kết đều mang nghĩa cộng dồn, nên
 * không có cạnh "nhân quả" giữa các lĩnh vực như bản đồ chiến lược kinh điển, và một KPI chỉ
 * thuộc một chỉ tiêu. Muốn có thì phải thêm bảng quan hệ nhiều-nhiều ở lõi BSC.
 */
@Service
@RequiredArgsConstructor
public class BscGoalGraphService {

    /** Ngưỡng màu dùng chung, phát kèm payload để client không giữ bản thứ hai. */
    private static final double GOOD_THRESHOLD = 90.0;
    private static final double WARN_THRESHOLD = 70.0;

    /** Mặc định chỉ trả 20 mục tiêu quan trọng nhất — BRD: đừng đổ cả đồ thị lớn ngay từ đầu. */
    private static final int DEFAULT_LIMIT = 20;

    private final AnalyticsScopeResolver scopeResolver;
    private final BscScorecardPerspectiveRepository itemRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final BscUnitResultItemRepository unitResultItemRepository;
    private final BscFixedPerspectiveRepository fixedPerspectiveRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final BscScoringService scoringService;
    private final BscTreeService treeService;
    private final BscCascadeService cascadeService;
    private final AnalyticsKpiMetrics metrics;

    // ============================================================
    // Đồ thị
    // ============================================================

    @Transactional(readOnly = true)
    public BscGoalGraphResponse goalGraph(UUID orgUnitId, Collection<UUID> periodIds,
                                          String status, Collection<String> perspectiveCodes, Integer limit) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        BscGoalGraphResponse.BscGoalGraphResponseBuilder b = BscGoalGraphResponse.builder()
                .thresholds(Thresholds.builder().good(GOOD_THRESHOLD).warn(WARN_THRESHOLD).build())
                .perspectives(List.of()).objectives(List.of()).edges(List.of());
        if (orgId == null) return b.build();

        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
        if (period == null) return b.build();
        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        b.periodId(period.getId()).periodName(period.getName());
        if (root == null) return b.build();

        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(root.getId(), period.getId()).orElse(null);
        Map<UUID, BscUnitResultItem> resultByRow = resultItems(result);
        Map<UUID, BscUnitResultItem> previousByPerspective = previousResultItems(orgId, orgUnitId, periodIds, period, root);
        ScorecardCoverageResponse coverage = treeService.coverage(root.getId());
        Map<UUID, CoverageItemResponse> coverageByRow = new HashMap<>();
        if (coverage.getItems() != null) {
            for (CoverageItemResponse ci : coverage.getItems()) coverageByRow.put(ci.getScorecardPerspectiveId(), ci);
        }

        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(root.getId());
        boolean zeroFill = root.getEmptyPerspectivePolicy() == com.kpitracking.enums.BscEmptyPerspectivePolicy.ZERO_FILL;
        Map<BscFixedPerspective, String[]> labels = perspectiveLabels(orgId);

        Set<String> wantPerspectives = perspectiveCodes == null || perspectiveCodes.isEmpty()
                ? null : new HashSet<>(perspectiveCodes);
        GoalStatus wantStatus = parseStatus(status);

        List<GraphObjective> all = new ArrayList<>();
        Map<String, int[]> perspectiveCounters = new LinkedHashMap<>();   // code → [số thứ tự]
        for (BscScorecardPerspective row : rows) {
            BscFixedPerspective fp = row.getPerspective() != null ? row.getPerspective().getFixedPerspective() : null;
            String code = fp == null ? UNCLASSIFIED : fp.name();
            int ordinal = perspectiveCounters.computeIfAbsent(code, k -> new int[]{0})[0]++ + 1;
            all.add(toObjective(row, code, labels.get(fp), ordinal, root,
                    resultByRow.get(row.getId()),
                    row.getPerspective() == null ? null : previousByPerspective.get(row.getPerspective().getId()),
                    coverageByRow.get(row.getId()), result));
        }

        List<GraphObjective> filtered = all.stream()
                .filter(o -> wantPerspectives == null || wantPerspectives.contains(o.getPerspectiveCode()))
                .filter(o -> wantStatus == null || o.getStatus() == wantStatus)
                .toList();

        // Cắt theo trọng số giảm dần: mục tiêu nặng nhất là mục tiêu đáng nhìn trước.
        int cap = limit == null || limit <= 0 ? DEFAULT_LIMIT : limit;
        List<GraphObjective> shown = filtered.stream()
                .sorted(Comparator.comparingDouble((GraphObjective o) -> o.getWeightPercentage() == null ? 0 : -o.getWeightPercentage())
                        .thenComparing(GraphObjective::getDerivedCode, Comparator.nullsLast(String::compareTo)))
                .limit(cap)
                .toList();

        Set<UUID> shownIds = shown.stream().map(GraphObjective::getId).collect(java.util.stream.Collectors.toSet());
        List<GraphEdge> edges = new ArrayList<>();
        for (GraphObjective o : shown) {
            if (o.getParentId() == null || !shownIds.contains(o.getParentId())) continue;
            edges.add(GraphEdge.builder()
                    .id(o.getParentId() + "->" + o.getId())
                    .sourceId(o.getParentId()).targetId(o.getId())
                    .kind("SUM".equals(o.getLinkType()) ? EdgeKind.CASCADE : EdgeKind.CONTRIBUTION)
                    .linkType(o.getLinkType()).contributionPercent(o.getContributionPercent())
                    .build());
        }

        return b.scorecardId(root.getId()).scorecardName(root.getName())
                .orgUnitName(unitNameOf(root)).level(root.getLevel())
                .scoringMode(root.getScoringMode() == null ? null : root.getScoringMode().name())
                .resultStatus(result == null ? null : result.getStatus())
                .provisional(isProvisional(result))
                .emptyPerspectivePolicy(zeroFill ? "ZERO_FILL" : "RENORMALIZE")
                .achievementPercent(result == null ? null : result.getAchievementPercent())
                .gatePassed(result == null ? null : result.getGatePassed())
                .perspectives(buildPerspectives(shown, labels, zeroFill))
                .objectives(shown).edges(edges)
                .hiddenObjectiveCount(filtered.size() - shown.size())
                .hiddenUnitCount(hiddenUnits(coverage, scope.unitIds()))
                .build();
    }

    // ============================================================
    // Drill-down một mục tiêu
    // ============================================================

    @Transactional(readOnly = true)
    public BscObjectiveContributorsResponse contributors(UUID itemId, UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        BscObjectiveContributorsResponse.BscObjectiveContributorsResponseBuilder b =
                BscObjectiveContributorsResponse.builder().units(List.of()).people(List.of()).kpis(List.of());
        if (orgId == null) return b.build();

        BscScorecardPerspective row = itemRepository.findById(itemId).orElse(null);
        if (row == null || row.getScorecard() == null) return b.build();
        BscScorecard card = row.getScorecard();
        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
        if (period == null) return b.build();

        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(card.getId(), period.getId()).orElse(null);
        Map<UUID, BscUnitResultItem> resultByRow = resultItems(result);
        ScorecardCoverageResponse coverage = treeService.coverage(card.getId());
        CoverageItemResponse cov = coverage.getItems() == null ? null : coverage.getItems().stream()
                .filter(ci -> itemId.equals(ci.getScorecardPerspectiveId())).findFirst().orElse(null);

        BscFixedPerspective fp = row.getPerspective() != null ? row.getPerspective().getFixedPerspective() : null;
        Map<BscFixedPerspective, String[]> labels = perspectiveLabels(orgId);
        GraphObjective objective = toObjective(row, fp == null ? UNCLASSIFIED : fp.name(), labels.get(fp), 1,
                card, resultByRow.get(row.getId()), null, cov, result);

        // Đơn vị con nhận phân rã — ngoài phạm vi quyền thì ĐẾM, không gộp số.
        List<ContributorUnit> units = new ArrayList<>();
        int hiddenUnits = 0;
        Set<UUID> allowed = scope.unitIds() == null ? null : new HashSet<>(scope.unitIds());
        if (cov != null && cov.getChildren() != null) {
            for (CoverageChildResponse ch : cov.getChildren()) {
                if (allowed != null && ch.getOrgUnitId() != null && !allowed.contains(ch.getOrgUnitId())) { hiddenUnits++; continue; }
                BscUnitResult childResult = ch.getScorecardId() == null ? null
                        : unitResultRepository.findByScorecardIdAndKpiPeriodId(ch.getScorecardId(), period.getId()).orElse(null);
                BscUnitResultItem childItem = ch.getScorecardPerspectiveId() == null || childResult == null ? null
                        : resultItems(childResult).get(ch.getScorecardPerspectiveId());
                units.add(ContributorUnit.builder()
                        .orgUnitId(ch.getOrgUnitId()).orgUnitName(ch.getOrgUnitName())
                        .scorecardId(ch.getScorecardId()).scorecardName(ch.getScorecardName())
                        .linkType(ch.getLinkType() == null ? null : ch.getLinkType().name())
                        .contributionValue(ch.getContributionValue()).contributionPercent(ch.getContributionPercent())
                        .targetValue(ch.getTargetValue())
                        .achievementPercent(childItem != null ? childItem.getAchievementPercent()
                                : childResult != null ? childResult.getAchievementPercent() : null)
                        .gatePassed(childResult == null ? null : childResult.getGatePassed())
                        .kpiCount(childItem == null ? 0 : (childItem.getKpiCount() == null ? 0 : childItem.getKpiCount()))
                        .build());
            }
        }

        // KPI của chính dòng chỉ tiêu này — cùng phép chia dòng mà "Tính lại" dùng.
        List<UUID> unitIds = card.getOrgUnits() == null ? List.of()
                : card.getOrgUnits().stream().map(OrgUnit::getId).toList();
        List<KpiCriteria> unitKpis = unitIds.isEmpty() ? List.of()
                : kpiCriteriaRepository.findByOrgUnitsAndPeriod(unitIds, period.getId(), AnalyticsKpiMetrics.SCORING_STATUSES);
        List<KpiCriteria> rowKpis = cascadeService.kpisOfRow(unitKpis, row);

        boolean waterfall = false;
        List<ContributorKpi> kpis = new ArrayList<>();
        Map<UUID, List<Double>> byUser = new LinkedHashMap<>();
        Map<UUID, User> userById = new LinkedHashMap<>();
        for (KpiCriteria kpi : rowKpis) {
            Double pct = metrics.bscAttainmentPercent(kpi, null, waterfall);
            kpis.add(ContributorKpi.builder()
                    .kpiId(kpi.getId()).name(kpi.getName())
                    .kpiType(kpi.getKpiType() == null ? null : kpi.getKpiType().name())
                    .unit(kpi.getUnit()).weight(kpi.getWeight())
                    .targetValue(kpi.getTargetValue())
                    .actualValue(metrics.actualValue(kpi, null, AnalyticsKpiMetrics.Window.ALL, waterfall))
                    .attainmentPercent(pct)
                    .assigneeNames(com.kpitracking.service.analytics.KpiMetricsCalculator.assigneeNames(kpi))
                    .periodName(kpi.getKpiPeriod() == null ? null : kpi.getKpiPeriod().getName())
                    .status(kpi.getStatus() == null ? null : kpi.getStatus().name())
                    .build());
            if (kpi.getAssignees() == null) continue;
            for (User u : kpi.getAssignees()) {
                userById.putIfAbsent(u.getId(), u);
                if (pct != null) byUser.computeIfAbsent(u.getId(), k -> new ArrayList<>()).add(pct);
            }
        }

        List<ContributorPerson> people = new ArrayList<>();
        for (Map.Entry<UUID, User> e : userById.entrySet()) {
            List<Double> pcts = byUser.getOrDefault(e.getKey(), List.of());
            people.add(ContributorPerson.builder()
                    .userId(e.getKey()).fullName(e.getValue().getFullName()).avatarUrl(e.getValue().getAvatarUrl())
                    .kpiCount((int) rowKpis.stream().filter(k -> k.getAssignees() != null
                            && k.getAssignees().stream().anyMatch(u -> u.getId().equals(e.getKey()))).count())
                    .attainmentPercent(pcts.isEmpty() ? null : pcts.stream().mapToDouble(Double::doubleValue).average().orElse(0))
                    .build());
        }

        return b.objective(objective).units(units).people(people).kpis(kpis)
                .hiddenUnitCount(hiddenUnits).hiddenPersonCount(0).build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    static final String UNCLASSIFIED = "UNCLASSIFIED";

    private GraphObjective toObjective(BscScorecardPerspective row, String code, String[] label, int ordinal,
                                       BscScorecard card, BscUnitResultItem item, BscUnitResultItem previous,
                                       CoverageItemResponse cov, BscUnitResult result) {
        Double achievement = item == null ? null : item.getAchievementPercent();
        return GraphObjective.builder()
                .id(row.getId())
                .derivedCode(derivedCode(code, ordinal))
                .name(row.getPerspective() != null ? row.getPerspective().getName() : null)
                .perspectiveCode(code)
                .perspectiveName(label != null ? label[0] : null)
                .color(label != null ? label[1] : (row.getPerspective() != null ? row.getPerspective().getColor() : null))
                .scorecardId(card.getId()).scorecardName(card.getName())
                .orgUnitName(unitNameOf(card)).level(card.getLevel())
                .parentId(row.getParentItem() == null ? null : row.getParentItem().getId())
                .linkType(row.getLinkType() == null ? null : row.getLinkType().name())
                .contributionValue(row.getContributionValue()).contributionPercent(row.getContributionPercent())
                .weightPercentage(row.getWeightPercentage())
                .targetValue(item != null && item.getTargetValue() != null ? item.getTargetValue() : row.getTargetValue())
                .minimumValue(row.getMinimumValue()).unit(row.getUnit())
                .actualValue(item == null ? null : item.getActualValue())
                .achievementPercent(achievement)
                .weightedScore(item == null ? null : item.getWeightedScore())
                .measurementSource(row.getMeasurementSource() == null ? null : row.getMeasurementSource().name())
                .isGate(Boolean.TRUE.equals(row.getIsGate()))
                .gateMinPercent(row.getGateMinPercent())
                .gatePassed(item == null ? null : item.getGatePassed())
                .origin(row.getOrigin() == null ? null : row.getOrigin().name())
                .hasResult(item != null)
                .provisional(isProvisional(result))
                .status(statusOf(achievement))
                .trend(trendOf(achievement, previous))
                .kpiCount(item == null || item.getKpiCount() == null ? 0 : item.getKpiCount())
                .childCount(cov == null || cov.getChildren() == null ? 0 : cov.getChildren().size())
                .coverageStatus(cov == null ? null : cov.getStatus())
                .coverageGap(cov == null ? null : cov.getGap())
                .hasMoreChildren(cov != null && cov.getChildren() != null && !cov.getChildren().isEmpty())
                .build();
    }

    /** "F1", "C2"… — chữ cái đầu của mã lĩnh vực + thứ tự. Suy ra, vì bảng không có cột mã. */
    private static String derivedCode(String perspectiveCode, int ordinal) {
        if (perspectiveCode == null || perspectiveCode.isBlank()) return "G" + ordinal;
        if (UNCLASSIFIED.equals(perspectiveCode)) return "X" + ordinal;
        return perspectiveCode.charAt(0) + String.valueOf(ordinal);
    }

    private static GoalStatus statusOf(Double achievement) {
        if (achievement == null) return GoalStatus.NO_DATA;
        if (achievement >= GOOD_THRESHOLD) return GoalStatus.GOOD;
        if (achievement >= WARN_THRESHOLD) return GoalStatus.WARN;
        return GoalStatus.BEHIND;
    }

    private static GoalTrend trendOf(Double now, BscUnitResultItem previous) {
        Double before = previous == null ? null : previous.getAchievementPercent();
        if (now == null || before == null) {
            return GoalTrend.builder().direction(before == null ? "NEW" : "FLAT").build();
        }
        double delta = now - before;
        return GoalTrend.builder().deltaPercent(delta)
                .direction(Math.abs(delta) < 0.05 ? "FLAT" : delta > 0 ? "UP" : "DOWN").build();
    }

    /**
     * %đạt theo lĩnh vực — ĐÚNG phép gộp mà {@code BscCascadeService.recompute} dùng cho %đạt tổng,
     * nếu không các dải không cộng khớp con số gốc.
     */
    static List<GraphPerspective> buildPerspectives(List<GraphObjective> objectives,
                                                     Map<BscFixedPerspective, String[]> labels, boolean zeroFill) {
        Map<String, double[]> acc = new LinkedHashMap<>();        // code → [Σ(w·a), Σw có mặt, Σw tất cả]
        Map<String, List<UUID>> ids = new LinkedHashMap<>();
        for (GraphObjective o : objectives) {
            ids.computeIfAbsent(o.getPerspectiveCode(), k -> new ArrayList<>()).add(o.getId());
            double w = o.getWeightPercentage() == null ? 0.0 : o.getWeightPercentage();
            if (w <= 0) continue;
            double[] a = acc.computeIfAbsent(o.getPerspectiveCode(), k -> new double[3]);
            a[2] += w;
            if (o.getAchievementPercent() == null) continue;
            a[0] += w * o.getAchievementPercent();
            a[1] += w;
        }
        List<GraphPerspective> out = new ArrayList<>();
        for (BscFixedPerspective fp : BscFixedPerspective.values()) add(out, fp.name(), labels.get(fp), acc, ids, zeroFill, out.size());
        add(out, UNCLASSIFIED, null, acc, ids, zeroFill, out.size());
        return out;
    }

    private static void add(List<GraphPerspective> out, String code, String[] label,
                            Map<String, double[]> acc, Map<String, List<UUID>> ids, boolean zeroFill, int order) {
        List<UUID> list = ids.get(code);
        if (list == null || list.isEmpty()) return;
        double[] a = acc.get(code);
        Double pct = null;
        if (a != null) {
            double denom = zeroFill ? a[2] : a[1];
            if (denom > 0) pct = a[0] / denom;
        }
        out.add(GraphPerspective.builder()
                .code(code).name(label != null ? label[0] : code).color(label != null ? label[1] : null)
                .displayOrder(order)
                .weightPercentage(a == null ? 0.0 : a[2])
                .achievementPercent(pct).objectiveIds(list).build());
    }

    /** Tên/màu lĩnh vực: mặc định của enum, đè bằng cấu hình của tổ chức nếu có (khoá theo `code`). */
    private Map<BscFixedPerspective, String[]> perspectiveLabels(UUID orgId) {
        Map<String, com.kpitracking.entity.BscFixedPerspectiveEntity> byCode = fixedPerspectiveRepository
                .findByOrganizationIdOrderByDisplayOrderAsc(orgId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        com.kpitracking.entity.BscFixedPerspectiveEntity::getCode, e -> e, (a, c) -> a));
        Map<BscFixedPerspective, String[]> out = new java.util.EnumMap<>(BscFixedPerspective.class);
        for (BscFixedPerspective fp : BscFixedPerspective.values()) {
            var e = byCode.get(fp.name());
            out.put(fp, new String[]{
                    e != null && e.getName() != null ? e.getName() : fp.getDisplayName(),
                    e != null && e.getColor() != null ? e.getColor() : fp.getColor()});
        }
        return out;
    }

    private Map<UUID, BscUnitResultItem> resultItems(BscUnitResult result) {
        if (result == null) return Map.of();
        Map<UUID, BscUnitResultItem> out = new HashMap<>();
        for (BscUnitResultItem it : unitResultItemRepository.findByUnitResultId(result.getId())) {
            if (it.getScorecardPerspective() != null) out.put(it.getScorecardPerspective().getId(), it);
        }
        return out;
    }

    /**
     * Kết quả của đợt LIỀN TRƯỚC, khoá theo HẠNG MỤC (`bsc_perspectives.id`) chứ không theo id dòng
     * chỉ tiêu: mỗi đợt là một thẻ điểm riêng với bộ dòng riêng, nên khoá theo id dòng thì không
     * đợt nào khớp đợt nào và mũi tên xu hướng luôn hiện "đợt đầu".
     */
    private Map<UUID, BscUnitResultItem> previousResultItems(UUID orgId, UUID orgUnitId, Collection<UUID> periodIds,
                                                            KpiPeriod current, BscScorecard root) {
        List<KpiPeriod> ordered = orderedPeriods(orgId, periodIds);
        KpiPeriod prev = null;
        for (KpiPeriod p : ordered) {
            if (p.getId().equals(current.getId())) break;
            prev = p;
        }
        if (prev == null) return Map.of();
        BscScorecard prevRoot = resolveRoot(orgId, orgUnitId, prev.getId());
        if (prevRoot == null) return Map.of();
        return itemsByPerspective(unitResultRepository.findByScorecardIdAndKpiPeriodId(prevRoot.getId(), prev.getId()).orElse(null));
    }

    /** Dòng kết quả khoá theo hạng mục — khoá DUY NHẤT so sánh được giữa hai đợt. */
    private Map<UUID, BscUnitResultItem> itemsByPerspective(BscUnitResult result) {
        if (result == null) return Map.of();
        Map<UUID, BscUnitResultItem> out = new HashMap<>();
        for (BscUnitResultItem it : unitResultItemRepository.findByUnitResultId(result.getId())) {
            var row = it.getScorecardPerspective();
            if (row != null && row.getPerspective() != null) out.put(row.getPerspective().getId(), it);
        }
        return out;
    }

    private static int hiddenUnits(ScorecardCoverageResponse coverage, List<UUID> allowedUnits) {
        if (coverage == null || coverage.getItems() == null || allowedUnits == null) return 0;
        Set<UUID> allowed = new HashSet<>(allowedUnits);
        Set<UUID> hidden = new HashSet<>();
        for (CoverageItemResponse it : coverage.getItems()) {
            if (it.getChildren() == null) continue;
            for (CoverageChildResponse ch : it.getChildren()) {
                if (ch.getOrgUnitId() != null && !allowed.contains(ch.getOrgUnitId())) hidden.add(ch.getOrgUnitId());
            }
        }
        return hidden.size();
    }

    private static GoalStatus parseStatus(String s) {
        if (s == null || s.isBlank() || "ALL".equalsIgnoreCase(s)) return null;
        try {
            return GoalStatus.valueOf(s.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean isProvisional(BscUnitResult r) {
        return r != null && r.getStatus() == com.kpitracking.enums.BscUnitResultStatus.DRAFT;
    }

    private static String unitNameOf(BscScorecard card) {
        if (card.getOrgUnits() == null || card.getOrgUnits().isEmpty()) return null;
        return card.getOrgUnits().iterator().next().getName();
    }

    /* Thẻ gốc và đợt: dùng ĐÚNG luật của BscOverviewService để hai tab không chỉ vào hai thẻ khác nhau. */

    private BscScorecard resolveRoot(UUID orgId, UUID orgUnitId, UUID periodId) {
        OrgUnit unit = orgUnitId == null ? null : orgUnitRepository.findById(orgUnitId).orElse(null);
        return scoringService.resolveScorecard(unit, orgId, periodId);
    }

    private KpiPeriod pickPeriod(UUID orgId, UUID orgUnitId, Collection<UUID> periodIds) {
        List<KpiPeriod> ordered = orderedPeriods(orgId, periodIds);
        if (ordered.isEmpty()) return null;
        for (int i = ordered.size() - 1; i >= 0; i--) {
            KpiPeriod p = ordered.get(i);
            BscScorecard root = resolveRoot(orgId, orgUnitId, p.getId());
            if (root != null && unitResultRepository.findByScorecardIdAndKpiPeriodId(root.getId(), p.getId()).isPresent()) return p;
        }
        return ordered.get(ordered.size() - 1);
    }

    private List<KpiPeriod> orderedPeriods(UUID orgId, Collection<UUID> periodIds) {
        List<KpiPeriod> all = new ArrayList<>(kpiPeriodRepository.findByOrganizationId(orgId));
        if (periodIds != null && !periodIds.isEmpty()) {
            Set<UUID> sel = new HashSet<>(periodIds);
            all.removeIf(p -> !sel.contains(p.getId()));
        }
        all.sort(Comparator.comparing((KpiPeriod p) -> p.getStartDate() == null ? java.time.Instant.EPOCH : p.getStartDate())
                .thenComparing(p -> p.getName() == null ? "" : p.getName()));
        return all;
    }
}
