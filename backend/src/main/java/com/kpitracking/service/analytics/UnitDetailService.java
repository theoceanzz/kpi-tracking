package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.BscOverviewResponses.AttainmentTrendResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.PerspectiveRef;
import com.kpitracking.dto.response.stats.BscOverviewResponses.TrendPoint;
import com.kpitracking.dto.response.stats.advanced.LeaderboardResponses.UnitRow;
import com.kpitracking.dto.response.stats.advanced.PersonDetailResponses.RatingLevelPoint;
import com.kpitracking.dto.response.stats.advanced.UnitDetailResponses.*;
import com.kpitracking.entity.EvaluationLevel;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.EvaluationLevelRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.BscOverviewService;
import com.kpitracking.service.KpiCycleEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Trang thống kê chi tiết MỘT đơn vị: hàng chỉ số, radar bốn lĩnh vực BSC, xu hướng từng lĩnh vực,
 * bậc xếp loại, và sổ đánh giá kỳ → đợt.
 *
 * <p><b>Luật xem nằm DUY NHẤT ở {@link #assertCanView}.</b> Service này gọi xuống
 * {@link BscOverviewService}, mà service đó tự giải phạm vi bằng {@code AnalyticsScopeResolver} —
 * bộ giải LỎNG hơn, chỉ kiểm "cùng tổ chức" nên truyền id một đơn vị ngang hàng vào là ra dữ liệu.
 * Mọi đường dữ liệu thêm vào đây phải đi qua phép kiểm đó trước.
 *
 * <p><b>Ràng buộc:</b> hàng chỉ số lấy nguyên từ {@code LeaderboardService.unitRows} chứ không tự
 * tính lại, để con số trùng khít hàng vừa bấm trên bảng xếp hạng. Biểu đồ thì đọc
 * {@code BscOverviewService.attainmentTrend}. Hai nguồn có thể lệch nhau ở một trường hợp: bảng xếp
 * hạng gom theo MỌI thẻ điểm có liệt kê đơn vị này, còn {@code attainmentTrend} đi theo đúng một
 * thẻ mà {@code BscScoringService.resolveScorecard} chọn — đơn vị nằm trong hai thẻ còn hiệu lực sẽ
 * ra hai con số.
 */
@Service
@RequiredArgsConstructor
public class UnitDetailService {

    /** Số đợt vẽ trên các đường xu hướng. */
    private static final int TREND_LIMIT = 12;

    private final StatsTierResolver tierResolver;
    private final LeaderboardService leaderboardService;
    private final BscOverviewService bscOverviewService;
    private final KpiCycleEvaluationService kpiCycleEvaluationService;
    private final OrgUnitRepository orgUnitRepository;
    private final OrganizationRepository organizationRepository;
    private final EvaluationLevelRepository evaluationLevelRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    /**
     * @param withCycles false thì bỏ sổ đánh giá kỳ → đợt. Đó là phần nặng nhất (mỗi kỳ một lượt
     *                   tổng hợp phòng ban), còn thẻ xem nhanh lúc rê chuột chỉ cần hàng chỉ số,
     *                   radar và đường xu hướng.
     */
    @Transactional(readOnly = true)
    public UnitDetailResponse detail(UUID orgUnitId, Collection<UUID> periodIds, UUID cycleId,
                                     boolean withCycles) {
        /*
          Giải phạm vi của chính NGƯỜI XEM (không lọc theo đơn vị), đúng như ô xếp hạng vẫn làm:
          nhờ vậy "đợt muộn nhất có số" mà hai bên chọn là một, và con số hai bên không lệch.
          Đây cũng là phép kiểm quyền — `StatsTierResolver.resolve` chỉ được gọi MỘT lần mỗi request.
        */
        StatsTierResolver.TierScope scope = tierResolver.resolve(null, periodIds);
        assertCanView(scope, orgUnitId);

        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.orgUnit"), "id", orgUnitId));
        Organization org = scope.orgId() == null ? null
                : organizationRepository.findById(scope.orgId()).orElse(null);
        boolean bscOn = org != null && Boolean.TRUE.equals(org.getEnableBsc());

        // Giảm dần theo ngưỡng: đúng thứ tự mà `levelOf` cần.
        List<EvaluationLevel> levels = scope.orgId() == null ? List.of()
                : evaluationLevelRepository.findByOrganizationIdOrderByThresholdDesc(scope.orgId());
        List<EvaluationLevel> ladder = new ArrayList<>(levels);
        Collections.reverse(ladder);

        UnitRow row = leaderboardService.unitRows(scope, cycleId, null, "bsc", "desc")
                .getRows().stream()
                .filter(r -> orgUnitId.equals(r.getOrgUnitId()))
                .findFirst().orElse(null);

        AttainmentTrendResponse bsc = bscOn
                ? bscOverviewService.attainmentTrend(orgUnitId, scope.periodIds())
                : AttainmentTrendResponse.builder().perspectives(List.of()).points(List.of()).build();
        List<PerspectiveRef> refs = bsc.getPerspectives() == null ? List.of() : bsc.getPerspectives();
        List<TrendPoint> points = recent(bsc.getPoints());
        TrendPoint latest = latestWithResult(points);

        List<KpiPeriod> periods = orderedPeriods(scope.periodIds());

        return UnitDetailResponse.builder()
                .orgUnitId(orgUnitId)
                .name(unit.getName())
                .parentName(unit.getParent() == null ? null : unit.getParent().getName())
                .periodName(latest == null ? null : latest.getLabel())
                .metrics(metrics(row, orgUnitId))
                .bsc(latest == null ? List.of() : axes(refs, latest.getByPerspective()))
                .bscTrend(points.stream().map(p -> BscTrendPoint.builder()
                        .periodId(p.getPeriodId()).periodName(p.getLabel())
                        .achievementPercent(round1(p.getAchievementPercent()))
                        .gatePassed(p.getGatePassed())
                        .provisional(p.isProvisional())
                        .axes(axes(refs, p.getByPerspective()))
                        .build()).toList())
                .trend(trend(points, levels, ladder))
                .ratingLevels(ladder.stream().map(l -> RatingLevelPoint.builder()
                        .name(l.getName()).color(l.getColor()).threshold(l.getThreshold()).build()).toList())
                .cycles(withCycles ? cycles(orgUnitId, periods, points, refs, levels) : List.of())
                .bscEnabled(bscOn)
                .build();
    }

    // ============================================================
    // Quyền
    // ============================================================

    /**
     * Trang này nêu tên đơn vị và số của người trong đó: cấp SELF không mở được trang nào, cấp
     * UNIT/ORG chỉ mở được đơn vị nằm trong phạm vi của mình.
     */
    private void assertCanView(StatsTierResolver.TierScope scope, UUID orgUnitId) {
        if (orgUnitId == null || scope.anonymize() || !scope.unitIds().contains(orgUnitId)) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_STATISTICS);
        }
    }

    // ============================================================
    // Từng phần
    // ============================================================

    private UnitMetrics metrics(UnitRow row, UUID orgUnitId) {
        Set<UUID> members = new HashSet<>();
        userRoleOrgUnitRepository.findByOrgUnitIdIn(List.of(orgUnitId)).forEach(a -> {
            if (a.getUser() != null && a.getUser().getDeletedAt() == null) members.add(a.getUser().getId());
        });

        return UnitMetrics.builder()
                .bscPercent(row == null ? null : row.getBscPercent())
                .avgKpiPercent(row == null ? null : row.getAvgKpiPercent())
                .kpiCount(row == null ? null : row.getKpiCount())
                .conductScore(row == null ? null : row.getConductScore())
                .conductMax(row == null ? null : row.getConductMax())
                .memberCount(members.size())
                .build();
    }

    /**
     * Bốn trục radar theo thứ tự cố định của {@link BscFixedPerspective}.
     *
     * <p>Rổ {@code UNCLASSIFIED} và mọi mã lạ bị loại: radar là bốn lĩnh vực kinh điển, chen một
     * trục "chưa phân loại" vào thì hình không còn so được với đơn vị khác. Lĩnh vực chưa có số trả
     * {@code null} chứ không phải 0 — "chưa chấm" mà vẽ thành đáy là đọc ngược sự thật.
     */
    static List<BscAxisPoint> axes(List<PerspectiveRef> refs, Map<String, Double> byPerspective) {
        Map<String, PerspectiveRef> byCode = new HashMap<>();
        if (refs != null) refs.forEach(r -> byCode.put(r.getCode(), r));

        List<BscAxisPoint> out = new ArrayList<>();
        for (BscFixedPerspective fixed : BscFixedPerspective.values()) {
            PerspectiveRef ref = byCode.get(fixed.name());
            Double value = byPerspective == null ? null : byPerspective.get(fixed.name());
            out.add(BscAxisPoint.builder()
                    .code(fixed.name())
                    .name(ref != null && ref.getName() != null ? ref.getName() : fixed.getDisplayName())
                    .color(ref != null && ref.getColor() != null ? ref.getColor() : fixed.getColor())
                    .percent(round1(value))
                    .build());
        }
        return out;
    }

    private List<UnitTrendPoint> trend(List<TrendPoint> points, List<EvaluationLevel> levels,
                                       List<EvaluationLevel> ladder) {
        List<UnitTrendPoint> out = new ArrayList<>();
        for (TrendPoint p : points) {
            Double pct = round1(p.getAchievementPercent());
            EvaluationLevel level = LeaderboardService.levelOf(levels, pct);
            int idx = level == null ? -1 : ladder.indexOf(level);
            out.add(UnitTrendPoint.builder()
                    .periodId(p.getPeriodId()).periodName(p.getLabel())
                    .bscPercent(pct)
                    .ratingName(level == null ? null : level.getName())
                    .ratingColor(level == null ? null : level.getColor())
                    .ratingIndex(idx < 0 ? null : idx + 1)
                    .build());
        }
        return out;
    }

    // ============================================================
    // Sổ đánh giá: kỳ → đợt (KHÔNG có KPI)
    // ============================================================

    private List<UnitCycle> cycles(UUID orgUnitId, List<KpiPeriod> periods, List<TrendPoint> points,
                                   List<PerspectiveRef> refs, List<EvaluationLevel> levels) {
        if (periods.isEmpty()) return List.of();
        Map<UUID, TrendPoint> byPeriod = new HashMap<>();
        points.forEach(p -> byPeriod.put(p.getPeriodId(), p));

        List<UnitCycle> out = new ArrayList<>();
        for (List<KpiPeriod> group : PersonDetailService.groupByCycle(periods)) {
            KpiCycle cycle = group.get(0).getKpiCycle();
            // ponytail: mỗi kỳ một lượt tổng hợp phòng ban — chấp nhận được cho trang MỘT đơn vị;
            // kỳ nhiều lên thì tách endpoint riêng, tải theo nhánh đang mở.
            var eval = cycle == null ? null
                    : kpiCycleEvaluationService.getUnitCycleSummary(cycle.getId(), orgUnitId);

            List<UnitPeriod> rows = new ArrayList<>();
            for (KpiPeriod p : group) {
                TrendPoint tp = byPeriod.get(p.getId());
                Double pct = tp == null ? null : round1(tp.getAchievementPercent());
                EvaluationLevel level = LeaderboardService.levelOf(levels, pct);
                rows.add(UnitPeriod.builder()
                        .periodId(p.getId()).name(p.getName())
                        .startDate(p.getStartDate()).endDate(p.getEndDate())
                        .bscPercent(pct)
                        .gatePassed(tp == null ? null : tp.getGatePassed())
                        .provisional(tp != null && tp.isProvisional())
                        .ratingName(level == null ? null : level.getName())
                        .ratingColor(level == null ? null : level.getColor())
                        .axes(tp == null ? List.of() : axes(refs, tp.getByPerspective()))
                        .build());
            }

            out.add(UnitCycle.builder()
                    .cycleId(cycle == null ? null : cycle.getId())
                    .name(cycle == null ? null : cycle.getName())
                    .startDate(cycle == null ? null : cycle.getStartDate())
                    .endDate(cycle == null ? null : cycle.getEndDate())
                    .evaluation(eval)
                    .periods(rows)
                    .build());
        }
        return out;
    }

    // ============================================================
    // Phụ trợ
    // ============================================================

    private static List<TrendPoint> recent(List<TrendPoint> points) {
        if (points == null || points.isEmpty()) return List.of();
        return points.size() <= TREND_LIMIT ? points
                : points.subList(points.size() - TREND_LIMIT, points.size());
    }

    /** Mốc muộn nhất THẬT SỰ có kết quả — đợt mới mở chưa tính thì radar phải lùi về đợt trước. */
    private static TrendPoint latestWithResult(List<TrendPoint> points) {
        for (int i = points.size() - 1; i >= 0; i--) {
            TrendPoint p = points.get(i);
            if (p.isHasResult() && p.getAchievementPercent() != null) return p;
        }
        return null;
    }

    private List<KpiPeriod> orderedPeriods(Collection<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return List.of();
        List<KpiPeriod> all = new ArrayList<>(kpiPeriodRepository.findAllById(periodIds));
        all.sort(Comparator.comparing(p -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate()));
        return all;
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
