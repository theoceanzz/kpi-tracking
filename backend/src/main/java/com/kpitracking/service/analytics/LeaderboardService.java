package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.LeaderboardResponses.*;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.CycleUserEvaluation;
import com.kpitracking.entity.EvaluationLevel;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.CycleUserEvaluationRepository;
import com.kpitracking.repository.EvaluationLevelRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.ConductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Ba ô mở đầu trang Thống kê: xếp hạng người, xếp hạng đơn vị, lưới nhiệt đơn vị × đợt.
 *
 * <p>Phạm vi đi qua {@link StatsTierResolver} chứ không phải {@link AnalyticsScopeResolver}: bảng
 * xếp hạng hiện TÊN người, mà cấp {@code SELF} không được thấy tên đồng nghiệp — cờ
 * {@code anonymize()} chỉ có ở tier scope.
 *
 * <p>Nguyên tắc truy vấn: mỗi cột một lời gọi theo LÔ cho cả danh sách. Bảng xếp hạng cũ
 * ({@code BscAnalyticsService}) hỏi điểm từng (người, đợt) nên 20 người × 6 đợt là 120 lượt — ở đây
 * không lặp lại chuyện đó.
 *
 * <p>Mọi tỉ lệ KPI đi qua {@link AnalyticsKpiMetrics}; không có công thức KPI nào viết ở đây.
 */
@Service
@RequiredArgsConstructor
public class LeaderboardService {

    /** Top mặc định — bảng dài hơn thì không còn là "bảng xếp hạng" mà là danh sách nhân sự. */
    private static final int DEFAULT_LIMIT = 10;

    private final StatsTierResolver tierResolver;
    private final EvaluationRepository evaluationRepository;
    private final EvaluationLevelRepository evaluationLevelRepository;
    private final CycleUserEvaluationRepository cycleUserEvaluationRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final BscUnitResultRepository bscUnitResultRepository;
    private final ConductService conductService;
    private final AnalyticsKpiMetrics metrics;

    // ============================================================
    // Xếp hạng người
    // ============================================================

    /**
     * Top người trong đơn vị đang xem VÀ toàn bộ cây con.
     *
     * @param cycleId có mặt thì xếp theo KỲ và bỏ qua hẳn bộ lọc đợt — cùng giao kèo với bảng xếp
     *                loại đơn vị (`UnitClassificationService`), vì điểm kỳ là điểm đã chốt chứ
     *                không phải bình quân các đợt.
     */
    @Transactional(readOnly = true)
    public PeopleLeaderboardResponse people(UUID orgUnitId, Collection<UUID> periodIds,
                                            UUID cycleId, Integer limit,
                                            String sortBy, String sortDir) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        Organization org = scope.orgId() == null ? null
                : organizationRepository.findById(scope.orgId()).orElse(null);
        boolean conductOn = org != null && Boolean.TRUE.equals(org.getEnableConduct());

        PeopleLeaderboardResponse.PeopleLeaderboardResponseBuilder b = PeopleLeaderboardResponse.builder()
                .rows(List.of()).anonymized(scope.anonymize()).conductEnabled(conductOn);
        if (scope.unitIds().isEmpty()) return b.build();

        List<PersonRow> rows = cycleId != null
                ? peopleByCycle(scope, cycleId)
                : peopleByPeriod(scope);

        // Hạnh kiểm: một lời gọi cho cả danh sách, đã tự xử lý phiếu kỳ chưa lưu và tổ chức tắt module.
        UUID conductTarget = cycleId != null ? cycleId : latestPeriodId(scope.periodIds());
        Map<UUID, ConductService.ConductAxis> axes = conductService.effectiveAxes(
                rows.stream().map(PersonRow::getUserId).filter(Objects::nonNull).toList(),
                cycleId != null ? ConductScope.CYCLE : ConductScope.PERIOD, conductTarget, org);
        Double conductMax = null;
        for (PersonRow r : rows) {
            ConductService.ConductAxis axis = axes.get(r.getUserId());
            if (axis == null) continue;
            r.setConductScore(round1(axis.score()));
            r.setConductMax(axis.maxScore());
            if (conductMax == null) conductMax = axis.maxScore();
        }

        // Xếp loại: ngưỡng của chính tổ chức, không viết cứng mốc nào ở đây.
        List<EvaluationLevel> levels = scope.orgId() == null ? List.of()
                : evaluationLevelRepository.findByOrganizationIdOrderByThresholdDesc(scope.orgId());
        for (PersonRow r : rows) {
            EvaluationLevel level = levelOf(levels, r.getKpiPercent());
            if (level == null) continue;
            r.setRatingName(level.getName());
            r.setRatingColor(level.getColor());
        }

        rows.sort(by(keyOfPerson(sortBy), sortDir));
        int cap = limit == null || limit <= 0 ? DEFAULT_LIMIT : limit;
        return b.rows(rows.stream().limit(cap).toList()).conductMax(conductMax).build();
    }

    /** Nhánh ĐỢT: danh tính + điểm từ `evaluations`, mỗi người giữ đợt muộn nhất trong phạm vi. */
    private List<PersonRow> peopleByPeriod(StatsTierResolver.TierScope scope) {
        List<Object[]> raw = evaluationRepository.behaviorCompletionPoints(scope.unitIds(), scope.periodIds());
        List<Object[]> latest = LatestEvaluationPicker.keepLatestPerUser(
                raw, r -> (UUID) r[0], r -> (Instant) r[6]);

        List<PersonRow> rows = new ArrayList<>();
        for (Object[] r : latest) {
            UUID userId = (UUID) r[0];
            rows.add(personRow(scope, userId, (String) r[1], (String) r[2], dbl(r[4])));
        }
        return rows;
    }

    /**
     * Nhánh KỲ: điểm đã chốt ở `cycle_user_evaluations`. Danh sách người lấy từ phân công đơn vị
     * chứ không từ bảng điểm — người chưa chốt kỳ vẫn phải có mặt để thấy mình chưa có số.
     */
    private List<PersonRow> peopleByCycle(StatsTierResolver.TierScope scope, UUID cycleId) {
        Map<UUID, String> unitOf = new LinkedHashMap<>();
        Map<UUID, String> nameOf = new LinkedHashMap<>();
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByOrgUnitIdIn(scope.unitIds())) {
            if (a.getUser() == null || a.getUser().getDeletedAt() != null) continue;
            nameOf.putIfAbsent(a.getUser().getId(), a.getUser().getFullName());
            unitOf.putIfAbsent(a.getUser().getId(), a.getOrgUnit() == null ? null : a.getOrgUnit().getName());
        }
        if (nameOf.isEmpty()) return List.of();

        Map<UUID, Double> scoreOf = new HashMap<>();
        for (CycleUserEvaluation e : cycleUserEvaluationRepository
                .findByKpiCycleIdAndUserIdIn(cycleId, List.copyOf(nameOf.keySet()))) {
            if (e.getUser() == null) continue;
            scoreOf.put(e.getUser().getId(), e.getFinalScore());
        }

        List<PersonRow> rows = new ArrayList<>();
        for (Map.Entry<UUID, String> en : nameOf.entrySet()) {
            rows.add(personRow(scope, en.getKey(), en.getValue(), unitOf.get(en.getKey()),
                    scoreOf.get(en.getKey())));
        }
        return rows;
    }

    private PersonRow personRow(StatsTierResolver.TierScope scope, UUID userId,
                                String fullName, String unitName, Double kpiPercent) {
        return personRow(scope.anonymize(), scope.userId(), userId, fullName, unitName, kpiPercent);
    }

    /**
     * Cấp SELF: mọi hàng không phải của chính mình bị bỏ tên VÀ đơn vị — bảng xếp hạng là chỗ dễ
     * rò danh tính nhất, vì nó vốn sinh ra để nêu tên.
     */
    static PersonRow personRow(boolean anonymize, UUID viewerId, UUID userId,
                               String fullName, String unitName, Double kpiPercent) {
        boolean self = userId != null && userId.equals(viewerId);
        boolean hide = anonymize && !self;
        return PersonRow.builder()
                .userId(hide ? null : userId)
                .fullName(hide ? "—" : fullName)
                .orgUnitName(hide ? null : unitName)
                .kpiPercent(round1(kpiPercent))
                .isSelf(self)
                .build();
    }

    // ============================================================
    // Xếp hạng đơn vị
    // ============================================================

    @Transactional(readOnly = true)
    public UnitLeaderboardResponse units(UUID orgUnitId, Collection<UUID> periodIds,
                                         UUID cycleId, Integer limit,
                                         String sortBy, String sortDir) {
        return unitRows(tierResolver.resolve(orgUnitId, periodIds), cycleId, limit, sortBy, sortDir);
    }

    /**
     * Phần thân của {@link #units} nhưng nhận sẵn phạm vi.
     *
     * <p>Trang chi tiết một đơn vị lấy hàng chỉ số từ đây chứ không tự tính lại — hai màn nói khác
     * nhau về một đơn vị là lỗi nặng hơn thiếu biểu đồ. Nó cũng đã tự giải phạm vi để kiểm quyền,
     * mà {@code StatsTierResolver.resolve} chỉ được gọi MỘT lần mỗi request.
     */
    @Transactional(readOnly = true)
    UnitLeaderboardResponse unitRows(StatsTierResolver.TierScope scope, UUID cycleId, Integer limit,
                                     String sortBy, String sortDir) {
        Organization org = scope.orgId() == null ? null
                : organizationRepository.findById(scope.orgId()).orElse(null);
        boolean conductOn = org != null && Boolean.TRUE.equals(org.getEnableConduct());
        boolean bscOn = org != null && Boolean.TRUE.equals(org.getEnableBsc());

        UnitLeaderboardResponse.UnitLeaderboardResponseBuilder b = UnitLeaderboardResponse.builder()
                .rows(List.of()).conductEnabled(conductOn).bscEnabled(bscOn);
        if (scope.unitIds().isEmpty() || scope.orgId() == null) return b.build();

        // %đạt BSC: MỘT lời gọi cho cả dải đợt rồi soi ngược về đơn vị.
        Map<UUID, Map<UUID, Double>> bscByPeriod = bscOn
                ? bscByPeriodAndUnit(scope.orgId(), scope.periodIds()) : Map.of();

        /*
          Đợt để soi: đợt MUỘN NHẤT CÓ SỐ, không phải đợt muộn nhất. Tổ chức nào cũng có vài đợt
          mới mở chưa ai tính — lấy thẳng đợt cuối là cả bảng ra trống trong khi đợt trước đó đầy đủ.
        */
        UUID periodId = cycleId != null ? lastPeriodOfCycle(cycleId)
                : latestPeriodWith(scope.periodIds(), bscByPeriod.keySet());
        if (periodId == null) return b.build();

        List<OrgUnit> units = orgUnitRepository.findAllById(scope.unitIds());
        Map<UUID, Double> bscByUnit = bscByPeriod.getOrDefault(periodId, Map.of());

        // KPI của cả cây trong MỘT lời gọi, gom theo đơn vị sở hữu rồi mới tính bình quân.
        Map<UUID, List<KpiCriteria>> kpisByUnit = new HashMap<>();
        for (KpiCriteria k : kpiCriteriaRepository.findByOrgUnitsAndPeriod(
                scope.unitIds(), periodId, AnalyticsKpiMetrics.SCORING_STATUSES)) {
            if (k.getOrgUnit() == null) continue;
            kpisByUnit.computeIfAbsent(k.getOrgUnit().getId(), x -> new ArrayList<>()).add(k);
        }

        // Hạnh kiểm theo đơn vị = bình quân điểm của người thuộc đơn vị đó.
        Map<UUID, UUID> unitOfUser = new HashMap<>();
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByOrgUnitIdIn(scope.unitIds())) {
            if (a.getUser() == null || a.getUser().getDeletedAt() != null || a.getOrgUnit() == null) continue;
            unitOfUser.putIfAbsent(a.getUser().getId(), a.getOrgUnit().getId());
        }
        Map<UUID, ConductService.ConductAxis> axes = conductService.effectiveAxes(
                List.copyOf(unitOfUser.keySet()),
                cycleId != null ? ConductScope.CYCLE : ConductScope.PERIOD,
                cycleId != null ? cycleId : periodId, org);
        Map<UUID, double[]> conductSum = new HashMap<>();   // unitId → [tổng, số người, thang]
        for (Map.Entry<UUID, UUID> en : unitOfUser.entrySet()) {
            ConductService.ConductAxis axis = axes.get(en.getKey());
            if (axis == null || axis.score() == null) continue;
            double[] acc = conductSum.computeIfAbsent(en.getValue(), x -> new double[3]);
            acc[0] += axis.score();
            acc[1] += 1;
            if (axis.maxScore() != null) acc[2] = axis.maxScore();
        }

        Double conductMax = null;
        List<UnitRow> rows = new ArrayList<>();
        for (OrgUnit u : units) {
            List<KpiCriteria> kpis = kpisByUnit.getOrDefault(u.getId(), List.of());
            double[] acc = conductSum.get(u.getId());
            Double conduct = acc == null || acc[1] == 0 ? null : round1(acc[0] / acc[1]);
            if (acc != null && acc[2] > 0 && conductMax == null) conductMax = acc[2];
            rows.add(UnitRow.builder()
                    .orgUnitId(u.getId())
                    .orgUnitName(u.getName())
                    .bscPercent(round1(bscByUnit.get(u.getId())))
                    .avgKpiPercent(round1(metrics.weightedAttainment(
                            kpis, null, AnalyticsKpiMetrics.Window.ALL, false)))
                    .kpiCount(kpis.size())
                    .conductScore(conduct)
                    .conductMax(acc == null || acc[2] <= 0 ? null : acc[2])
                    .build());
        }

        // Mặc định xếp theo đóng góp BSC (cột đầu của bảng); tổ chức tắt BSC thì cột đó rỗng
        // ở mọi hàng nên rơi về %KPI, không thì bảng xếp theo một cột toàn dấu gạch.
        String unitKey = sortBy == null && !bscOn ? "kpi" : sortBy;
        rows.sort(by(keyOfUnit(unitKey), sortDir)
                .thenComparing(UnitRow::getAvgKpiPercent, Comparator.nullsLast(Comparator.reverseOrder())));
        int cap = limit == null || limit <= 0 ? DEFAULT_LIMIT : limit;
        return b.rows(rows.stream().limit(cap).toList()).conductMax(conductMax).build();
    }

    // ============================================================
    // Lưới nhiệt đơn vị × đợt
    // ============================================================

    @Transactional(readOnly = true)
    public UnitPeriodHeatmapResponse unitPeriodHeatmap(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        UnitPeriodHeatmapResponse.UnitPeriodHeatmapResponseBuilder b = UnitPeriodHeatmapResponse.builder()
                .periods(List.of()).units(List.of()).source("BSC");
        if (scope.unitIds().isEmpty() || scope.orgId() == null) return b.build();

        List<KpiPeriod> periods = new ArrayList<>(kpiPeriodRepository.findAllById(scope.periodIds()));
        periods.sort(Comparator.comparing(p -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate()));
        if (periods.isEmpty()) return b.build();

        Map<UUID, Map<UUID, Double>> byPeriodUnit = bscByPeriodAndUnit(scope.orgId(), scope.periodIds());
        // Đợt chưa đợt nào có số chỉ là một cột xám — bỏ đi cho lưới gọn, nhất là với tổ chức có
        // hàng chục đợt cũ chưa tính.
        periods.removeIf(x -> byPeriodUnit.getOrDefault(x.getId(), Map.of()).isEmpty());
        if (periods.isEmpty()) return b.build();

        List<OrgUnit> units = new ArrayList<>(orgUnitRepository.findAllById(scope.unitIds()));
        units.sort(Comparator.comparing((OrgUnit u) -> u.getPath() == null ? "" : u.getPath()));
        int rootDepth = units.isEmpty() ? 0 : depthOf(units.get(0));

        List<HeatmapUnitRow> rows = new ArrayList<>();
        for (OrgUnit u : units) {
            List<Double> cells = new ArrayList<>();
            boolean any = false;
            for (KpiPeriod p : periods) {
                Double v = round1(byPeriodUnit.getOrDefault(p.getId(), Map.of()).get(u.getId()));
                if (v != null) any = true;
                cells.add(v);
            }
            // Đơn vị không có số ở đợt nào thì là một hàng trống trơn — bỏ đi cho lưới đọc được.
            if (!any) continue;
            rows.add(HeatmapUnitRow.builder()
                    .orgUnitId(u.getId()).name(u.getName())
                    .depth(Math.max(0, depthOf(u) - rootDepth))
                    .cells(cells).build());
        }

        return b.periods(periods.stream()
                        .map(p -> HeatmapPeriod.builder().id(p.getId()).name(p.getName()).build())
                        .toList())
                .units(rows)
                .build();
    }

    // ============================================================
    // Phụ trợ
    // ============================================================

    /*
      Xếp rồi MỚI cắt `limit`: "10 thấp nhất" là mười hàng cuối của cả danh sách, không phải mười
      hàng đầu đảo ngược.

      Hàng thiếu số luôn nằm cuối ở CẢ HAI chiều (`nullsLast` trên thứ tự đã đảo): người chưa được
      chấm không phải là "người điểm thấp nhất", để họ đứng đầu bảng "thấp nhất" là vu oan.
    */
    static <T> Comparator<T> by(java.util.function.Function<T, Double> key, String dir) {
        boolean asc = "asc".equalsIgnoreCase(dir);
        Comparator<Double> order = asc ? Comparator.naturalOrder() : Comparator.reverseOrder();
        return Comparator.comparing(key, Comparator.nullsLast(order));
    }

    static java.util.function.Function<PersonRow, Double> keyOfPerson(String sortBy) {
        return "conduct".equals(sortBy) ? PersonRow::getConductScore : PersonRow::getKpiPercent;
    }

    static java.util.function.Function<UnitRow, Double> keyOfUnit(String sortBy) {
        if (sortBy == null) return UnitRow::getBscPercent;
        return switch (sortBy) {
            case "kpi" -> UnitRow::getAvgKpiPercent;
            case "kpiCount" -> r -> r.getKpiCount() == null ? null : r.getKpiCount().doubleValue();
            case "conduct" -> UnitRow::getConductScore;
            default -> UnitRow::getBscPercent;
        };
    }

    /** %đạt BSC của mọi (đợt, đơn vị) trong phạm vi — một lời gọi cho cả dải. */
    private Map<UUID, Map<UUID, Double>> bscByPeriodAndUnit(UUID orgId, Collection<UUID> periodIds) {
        if (orgId == null || periodIds == null || periodIds.isEmpty()) return Map.of();
        Map<UUID, Map<UUID, Double>> out = new LinkedHashMap<>();
        for (BscUnitResult r : bscUnitResultRepository.findByOrganizationAndPeriods(orgId, periodIds)) {
            if (r.getScorecard() == null || r.getKpiPeriod() == null || r.getAchievementPercent() == null) continue;
            Map<UUID, Double> cell = out.computeIfAbsent(r.getKpiPeriod().getId(), x -> new HashMap<>());
            for (OrgUnit u : r.getScorecard().getOrgUnits()) cell.put(u.getId(), r.getAchievementPercent());
        }
        return out;
    }

    /**
     * Đợt MUỘN NHẤT trong phạm vi mà {@code withData} có mặt; không đợt nào có số thì rơi về đợt
     * muộn nhất, để ô còn nói được "đợt X chưa tính" thay vì trống trơn.
     */
    private UUID latestPeriodWith(Collection<UUID> periodIds, java.util.Set<UUID> withData) {
        if (periodIds == null || periodIds.isEmpty()) return null;
        List<KpiPeriod> ordered = new ArrayList<>(kpiPeriodRepository.findAllById(periodIds));
        ordered.sort(Comparator.comparing((KpiPeriod p) -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate()));
        for (int i = ordered.size() - 1; i >= 0; i--) {
            if (withData.contains(ordered.get(i).getId())) return ordered.get(i).getId();
        }
        return ordered.isEmpty() ? null : ordered.get(ordered.size() - 1).getId();
    }

    /** Đợt MUỘN NHẤT trong phạm vi. */
    private UUID latestPeriodId(Collection<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return null;
        return kpiPeriodRepository.findAllById(periodIds).stream()
                .max(Comparator.comparing(p -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate()))
                .map(KpiPeriod::getId).orElse(null);
    }

    private UUID lastPeriodOfCycle(UUID cycleId) {
        List<KpiPeriod> ps = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycleId);
        return ps.isEmpty() ? null : ps.get(ps.size() - 1).getId();
    }

    /** Mức xếp loại đầu tiên mà điểm còn với tới; danh sách đã sắp ngưỡng giảm dần. */
    static EvaluationLevel levelOf(List<EvaluationLevel> levels, Double value) {
        if (value == null) return null;
        for (EvaluationLevel l : levels) {
            if (l.getThreshold() != null && value >= l.getThreshold()) return l;
        }
        return null;
    }

    private static int depthOf(OrgUnit u) {
        String path = u.getPath();
        if (path == null || path.isEmpty()) return 0;
        int n = 0;
        for (int i = 0; i < path.length(); i++) if (path.charAt(i) == '/') n++;
        return n;
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
