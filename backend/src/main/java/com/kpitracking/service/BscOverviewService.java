package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.*;
import static com.kpitracking.dto.response.stats.BscOverviewResponses.UNCLASSIFIED;
import com.kpitracking.entity.BscFixedPerspectiveEntity;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.repository.BscFixedPerspectiveRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
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
    private final OrgUnitRepository orgUnitRepository;
    /** Luật chọn thẻ điểm là của core — tab chỉ gọi lại, không tự suy. */
    private final BscScoringService scoringService;

    // ============================================================
    // Thẻ số liệu
    // ============================================================

    @Transactional(readOnly = true)
    public OverviewResponse overview(UUID orgUnitId, Collection<UUID> periodIds) {
        var scope = scopeResolver.resolve(orgUnitId, periodIds);
        UUID orgId = scope.orgId();
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        if (orgId == null) return OverviewResponse.builder().unitStatusCounts(Map.of()).coverage(emptyCoverage()).build();

        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
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

        /*
          Kết quả còn DRAFT đếm riêng: nó sẽ đổi sau lần "Tính lại" kế tiếp, nên gộp vào số tổng
          hợp là báo cáo một bức tranh chưa chốt như thể đã chốt. Cổng chặn chia BA rổ — trước đây
          `else gateOk++` gộp cả thẻ chưa kết luận được (gatePassed = null) vào "đạt".
         */
        Map<String, Integer> statusCounts = new LinkedHashMap<>();
        int withResult = 0, gateOk = 0, gateFail = 0, gateUnknown = 0, provisional = 0;
        for (BscScorecard s : subtree) {
            if (s.getId().equals(root.getId())) continue;
            statusCounts.merge(s.getStatus() == null ? "DRAFT" : s.getStatus().name(), 1, Integer::sum);
            BscUnitResult r = results.get(s.getId());
            if (r == null) continue;
            if (isProvisional(r)) { provisional++; continue; }
            withResult++;
            if (Boolean.FALSE.equals(r.getGatePassed())) gateFail++;
            else if (Boolean.TRUE.equals(r.getGatePassed())) gateOk++;
            else gateUnknown++;
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
                .unitsGateUnknown(gateUnknown).unitsProvisional(provisional)
                .provisional(isProvisional(rootResult))
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
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        if (orgId == null) return List.of();
        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
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
                .provisional(isProvisional(r))
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
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        if (orgId == null) return ItemAttainmentResponse.builder().items(List.of()).build();
        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
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
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
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

            /*
              %đạt theo lĩnh vực phải dùng ĐÚNG phép gộp mà BscCascadeService.recompute dùng cho
              %đạt tổng, nếu không bốn đường lĩnh vực không bao giờ cộng khớp đường tổng:
              - trọng số 0/null đóng góp 0 (trước đây thay bằng 1.0 ⇒ hàng trọng số 0 vẫn kéo đường);
              - ZERO_FILL chia cho TỔNG trọng số, RENORMALIZE chia cho trọng số CÓ mặt;
              - chỉ tiêu không gắn lĩnh vực vào rổ UNCLASSIFIED thay vì bị bỏ đi;
              - không làm tròn ở đây (tròn một lần ở lớp hiển thị).
             */
            boolean zeroFill = root.getEmptyPerspectivePolicy() == com.kpitracking.enums.BscEmptyPerspectivePolicy.ZERO_FILL;
            Map<String, double[]> acc = new LinkedHashMap<>(); // code → [Σ(w·a), Σw có mặt, Σw tất cả]
            for (BscUnitResultItem it : unitResultItemRepository.findByUnitResultId(r.getId())) {
                BscScorecardPerspective row = it.getScorecardPerspective();
                BscFixedPerspective fp = row != null && row.getPerspective() != null ? row.getPerspective().getFixedPerspective() : null;
                double w = it.getWeightPercentage() != null ? it.getWeightPercentage() : 0.0;
                if (w <= 0) continue;
                double[] a = acc.computeIfAbsent(fp == null ? UNCLASSIFIED : fp.name(), k -> new double[3]);
                a[2] += w;
                if (it.getAchievementPercent() == null) continue;
                a[0] += w * it.getAchievementPercent();
                a[1] += w;
            }
            Map<String, Double> byP = new LinkedHashMap<>();
            for (BscFixedPerspective fp : BscFixedPerspective.values()) putPerspective(byP, acc, fp.name(), zeroFill);
            putPerspective(byP, acc, UNCLASSIFIED, zeroFill);
            points.add(tp.hasResult(true).provisional(isProvisional(r))
                    .achievementPercent(r.getAchievementPercent())
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
        // "Tất cả đơn vị" = đơn vị CAO NHẤT trong phạm vi xem. resolveScorecard chỉ nhận MỘT đơn vị
        // và không đi ngược lên cha, nên để null là chắc chắn không ra bộ tiêu chí nào.
        if (orgUnitId == null) orgUnitId = scopeResolver.topUnitId(scope);
        if (orgId == null) return emptyCoverageResponse();
        KpiPeriod period = pickPeriod(orgId, orgUnitId, periodIds);
        if (period == null) return emptyCoverageResponse();
        BscScorecard root = resolveRoot(orgId, orgUnitId, period.getId());
        if (root == null) return emptyCoverageResponse();
        return treeService.coverage(root.getId());
    }

    // ============================================================
    // Helpers
    // ============================================================

    /**
     * Thẻ gốc của phạm vi trong một đợt — ĐÚNG luật mà {@link BscScoringService#resolveScorecard}
     * dùng khi chấm điểm cá nhân: từ đơn vị đi ngược lên cây đơn vị, hết thì lấy thẻ mặc định của
     * tổ chức; hoà thì thẻ gắn thẳng đợt thắng.
     *
     * <p>Trước đây tab tự suy một luật khác (đơn vị → thẻ CÔNG TY → mặc định, ưu tiên ACTIVE rồi
     * mới nhất). Tổ chức có nhiều thẻ khớp thì hai luật chọn hai thẻ, và tab báo cáo trên một thẻ
     * khác với thẻ đã sinh ra điểm của nhân viên.
     */
    private BscScorecard resolveRoot(UUID orgId, UUID orgUnitId, UUID periodId) {
        OrgUnit unit = orgUnitId == null ? null : orgUnitRepository.findById(orgUnitId).orElse(null);
        return scoringService.resolveScorecard(unit, orgId, periodId);
    }

    /**
     * Đợt để soi cho các ô "một đợt": đợt MUỘN NHẤT trong lựa chọn mà CHÍNH THẺ GỐC của phạm vi
     * đã có kết quả; không đợt nào có thì lấy đợt muộn nhất — để ô còn nói được "đợt X chưa tính"
     * thay vì trống trơn.
     *
     * <p>Trước đây chỉ hỏi "đợt này có kết quả nào trong toàn tổ chức không", nên kết quả của một
     * đơn vị khác đủ để kéo tab sang một đợt mà thẻ gốc chưa tính.
     */
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

    /** Kết quả đợt còn DRAFT = số liệu chưa chốt. Null (chưa tính) KHÔNG phải là nháp. */
    private static boolean isProvisional(BscUnitResult r) {
        return r != null && r.getStatus() == com.kpitracking.enums.BscUnitResultStatus.DRAFT;
    }

    /** Một rổ lĩnh vực trên đường xu hướng; mẫu số theo chính sách của thẻ điểm. */
    private static void putPerspective(Map<String, Double> out, Map<String, double[]> acc, String code, boolean zeroFill) {
        double[] a = acc.get(code);
        if (a == null) return;
        double denom = zeroFill ? a[2] : a[1];
        if (denom > 0) out.put(code, a[0] / denom);
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
