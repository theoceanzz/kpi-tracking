package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.conduct.ConductItemResponse;
import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.dto.response.stats.advanced.PersonDetailResponses.*;
import com.kpitracking.entity.evaluation.Evaluation;
import com.kpitracking.entity.evaluation.EvaluationLevel;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.kpi.KpiCycle;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.conduct.ConductScope;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.evaluation.EvaluationLevelRepository;
import com.kpitracking.repository.evaluation.EvaluationRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.repository.submission.KpiSubmissionRepository;
import com.kpitracking.repository.organization.OrganizationRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.conduct.ConductService;
import com.kpitracking.service.evaluation.EvaluationService;
import com.kpitracking.service.evaluation.KpiCycleEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Trang thống kê chi tiết MỘT người: hàng chỉ số, radar giá trị cốt lõi, diễn biến, và sổ đánh giá
 * kỳ -> đợt -> KPI.
 *
 * <p><b>Ràng buộc then chốt:</b> con số ở đây phải TRÙNG hàng trên bảng xếp hạng vừa bấm. Vì vậy
 * "% Hiệu suất" đọc đúng cột mà {@link LeaderboardService} đọc ({@code kpiCompletionPercent}) chứ
 * không gọi {@code EvaluationService.getEffectivePerformanceScore} — hàm đó trả điểm ma trận 1..5
 * cho tổ chức bật hạnh kiểm/định tính, nên trang chi tiết sẽ hiện "5" trong khi hàng vừa bấm hiện
 * "125%".
 *
 * <p><b>Luật xem nằm DUY NHẤT ở {@link #assertCanView}.</b> Service này gọi thẳng hai hàm tính toán
 * mà bình thường bị chặn ở controller ({@code ConductService.sheetForAnalytics},
 * {@code KpiCycleEvaluationService.getUserCycleEvaluation} — cả hai không tự kiểm quyền), nên mọi
 * đường dữ liệu mới thêm vào đây phải đi qua hàm chặn đó trước.
 */
@Service
@RequiredArgsConstructor
public class PersonDetailService {

    /** Trần quét KPI một lần mở trang — đủ cho vài chục đợt, vẫn chặn trường hợp bất thường. */
    private static final int KPI_SCAN = 300;
    /** Số đợt vẽ trên đường xu hướng. */
    private static final int TREND_LIMIT = 12;

    private final StatsTierResolver tierResolver;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrganizationRepository organizationRepository;
    private final EvaluationService evaluationService;
    private final EvaluationLevelRepository evaluationLevelRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiCycleEvaluationService kpiCycleEvaluationService;
    private final PermissionChecker permissionChecker;
    private final ConductService conductService;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final AnalyticsKpiMetrics metrics;

    /**
     * @param withCycles false thì bỏ hẳn sổ đánh giá kỳ → đợt → KPI. Đó là phần nặng nhất (mỗi kỳ
     *                   một lượt tính điểm chốt), còn thẻ xem nhanh lúc rê chuột chỉ cần hàng chỉ
     *                   số, radar và đường xu hướng.
     */
    @Transactional(readOnly = true)
    public PersonDetailResponse detail(UUID userId, Collection<UUID> periodIds, UUID cycleId,
                                       boolean withCycles) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(null, periodIds);
        assertCanView(scope, userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));
        Organization org = scope.orgId() == null ? null
                : organizationRepository.findById(scope.orgId()).orElse(null);
        // Giảm dần theo ngưỡng: đúng thứ tự mà `levelOf` cần (lấy bậc đầu tiên mà điểm còn với tới).
        List<EvaluationLevel> levels = scope.orgId() == null ? List.of()
                : evaluationLevelRepository.findByOrganizationIdOrderByThresholdDesc(scope.orgId());
        // Tăng dần: trục Y của biểu đồ bậc xếp loại, bậc thấp nhất nằm đáy.
        List<EvaluationLevel> ladder = new ArrayList<>(levels);
        Collections.reverse(ladder);

        List<KpiPeriod> periods = orderedPeriods(scope.periodIds());
        List<PersonTrendPoint> trend = trend(userId, periods, levels, ladder);
        // Đợt để soi hàng chỉ số: đợt MUỘN NHẤT CÓ SỐ. Tổ chức nào cũng có vài đợt mới mở chưa ai
        // chấm — lấy thẳng đợt cuối là cả hàng chỉ số trống trong khi đợt trước đó đầy đủ.
        PersonTrendPoint latest = trend.stream()
                .filter(t -> t.getPerformancePercent() != null)
                .reduce((a, b) -> b).orElse(trend.isEmpty() ? null : trend.get(trend.size() - 1));
        UUID periodId = latest != null ? latest.getPeriodId()
                : periods.isEmpty() ? null : periods.get(periods.size() - 1).getId();

        UUID conductTarget = cycleId != null ? cycleId : periodId;
        ConductScope conductScope = cycleId != null ? ConductScope.CYCLE : ConductScope.PERIOD;
        ConductSheetResponse sheet = conductService.sheetForAnalytics(userId, conductScope, conductTarget, org);

        return PersonDetailResponse.builder()
                .userId(userId)
                .fullName(user.getFullName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .orgUnitName(unitNameOf(userId))
                .periodName(latest != null ? latest.getPeriodName() : null)
                .metrics(metrics(userId, latest, sheet, scope.periodIds()))
                .conduct(axes(sheet))
                .trend(trend)
                .ratingLevels(ladder.stream().map(l -> RatingLevelPoint.builder()
                        .name(l.getName()).color(l.getColor()).threshold(l.getThreshold()).build()).toList())
                .cycles(withCycles ? cycles(user, periods, levels) : List.of())
                .build();
    }

    // ============================================================
    // Quyền
    // ============================================================

    /**
     * Trang này NÊU TÊN nên không có chỗ cho ẩn danh: cấp SELF chỉ mở được trang của chính mình,
     * cấp UNIT/ORG chỉ mở được người nằm trong phạm vi đơn vị của mình.
     */
    private void assertCanView(StatsTierResolver.TierScope scope, UUID userId) {
        if (userId == null) throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_STATISTICS);
        if (userId.equals(scope.userId())) return;
        if (scope.anonymize()) throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_STATISTICS);

        Set<UUID> allowed = new HashSet<>(scope.unitIds());
        boolean inScope = userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(r -> r.getOrgUnit() != null && allowed.contains(r.getOrgUnit().getId()));
        if (!inScope) throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_STATISTICS);
    }

    // ============================================================
    // Hàng chỉ số, radar, xu hướng
    // ============================================================

    private PersonMetrics metrics(UUID userId, PersonTrendPoint latest,
                                  ConductSheetResponse sheet, Collection<UUID> periodIds) {
        // Điểm hạnh kiểm của chính phiếu (quản lý chấm, thiếu thì tự chấm) — cùng con số mà bảng
        // xếp hạng hiện, chứ không phải `behaviorScore` của phiếu đánh giá KPI.
        Double conductScore = sheet == null ? null : round1(sheet.getEffectiveScore());
        Double conductMax = sheet == null ? null : sheet.getMaxScore();
        int[] late = lateness(userId, periodIds);

        return PersonMetrics.builder()
                .performancePercent(latest == null ? null : latest.getPerformancePercent())
                .conductScore(conductScore)
                .conductMax(conductMax)
                .ratingName(latest == null ? null : latest.getRatingName())
                .ratingColor(latest == null ? null : latest.getRatingColor())
                .lateCount(late[0]).totalCount(late[1])
                .latePercent(late[1] == 0 ? null : round1(100.0 * late[0] / late[1]))
                .build();
    }

    /**
     * Trễ hẹn: với mỗi (KPI được giao, đợt), bài nộp đầu tiên có trước khi đợt đóng không. Không có
     * bài nào cũng tính là trễ — "chưa nộp" với "nộp muộn" đều là lỗi hẹn, gộp lại mới ra con số
     * người quản lý cần.
     *
     * @return {@code [số kỳ trễ, tổng số kỳ]}
     */
    private int[] lateness(UUID userId, Collection<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return new int[]{0, 0};
        return countLate(kpiSubmissionRepository.submissionTimelinessByAssignee(userId, periodIds));
    }

    /** Tách riêng phần ĐẾM để kiểm được mà không phải dựng cả rừng repository giả. */
    static int[] countLate(List<Object[]> rows) {
        int late = 0, total = 0;
        for (Object[] r : rows) {
            total++;
            Instant end = (Instant) r[1];
            Instant first = (Instant) r[2];
            if (first == null || (end != null && first.isAfter(end))) late++;
        }
        return new int[]{late, total};
    }

    private List<ConductAxisPoint> axes(ConductSheetResponse sheet) {
        if (sheet == null || sheet.getItems() == null) return List.of();
        List<ConductAxisPoint> out = new ArrayList<>();
        for (ConductItemResponse i : sheet.getItems()) {
            out.add(ConductAxisPoint.builder()
                    .criteriaName(i.getName())
                    .weight(i.getWeight())
                    .selfScore(round1(i.getSelfScore()))
                    .managerScore(round1(i.getManagerScore()))
                    // Thang nằm ở PHIẾU, không ở từng dòng — chép xuống mỗi đỉnh để radar không
                    // phải đi tra ngược lên.
                    .maxScore(sheet.getMaxScore())
                    .minScore(sheet.getMinScore())
                    .build());
        }
        return out;
    }

    /**
     * Mỗi đợt một điểm, lấy qua {@code getEffectiveEvaluation} chứ không bình quân mọi dòng của đợt:
     * bảng {@code evaluations} lưu cả phiếu tự chấm, cộng hết vào là đường xu hướng bị chính người
     * được xem kéo lên.
     *
     * <p>{@code ratingIndex} là vị trí của bậc trên thang TĂNG DẦN — toạ độ Y của biểu đồ bậc xếp
     * loại. Tên bậc vẫn gửi kèm để chỗ nào chỉ cần chữ thì khỏi tra ngược.
     */
    private List<PersonTrendPoint> trend(UUID userId, List<KpiPeriod> periods,
                                         List<EvaluationLevel> levels, List<EvaluationLevel> ladder) {
        List<KpiPeriod> recent = periods.size() <= TREND_LIMIT ? periods
                : periods.subList(periods.size() - TREND_LIMIT, periods.size());

        List<PersonTrendPoint> out = new ArrayList<>();
        for (KpiPeriod p : recent) {
            Evaluation e = evaluationService.getEffectiveEvaluation(userId, p.getId());
            Double pct = e == null ? null : e.getKpiCompletionPercent();
            EvaluationLevel level = LeaderboardService.levelOf(levels, pct);
            int idx = level == null ? -1 : ladder.indexOf(level);
            out.add(PersonTrendPoint.builder()
                    .periodId(p.getId()).periodName(p.getName())
                    .performancePercent(round1(pct))
                    .conductScore(e == null ? null : round1(e.getBehaviorScore()))
                    .ratingName(level == null ? null : level.getName())
                    .ratingColor(level == null ? null : level.getColor())
                    .ratingIndex(idx < 0 ? null : idx + 1)
                    .build());
        }
        return out;
    }

    // ============================================================
    // Sổ đánh giá: kỳ -> đợt -> KPI
    // ============================================================

    private List<PersonCycle> cycles(User user, List<KpiPeriod> periods, List<EvaluationLevel> levels) {
        if (periods.isEmpty()) return List.of();
        UUID userId = user.getId();
        List<UUID> periodIds = periods.stream().map(KpiPeriod::getId).toList();

        Map<UUID, List<EvaluatorScore>> scorers = evaluatorScores(userId, periodIds);
        Map<UUID, List<PersonKpiRow>> kpis = kpisByPeriod(userId, new HashSet<>(periodIds));

        List<PersonCycle> out = new ArrayList<>();
        for (List<KpiPeriod> group : groupByCycle(periods)) {
            KpiCycle cycle = group.get(0).getKpiCycle();
            // ponytail: mỗi kỳ một computeUser (mỗi cái lại quét hết đợt của nó) — chấp nhận được
            // cho trang MỘT người; kỳ nhiều lên thì tách endpoint riêng, tải theo tab đang mở.
            CycleUserEvaluationResponse eval = cycle == null ? null
                    : kpiCycleEvaluationService.getUserCycleEvaluation(cycle.getId(), userId);

            Map<UUID, CycleUserEvaluationResponse.PeriodBreakdown> breakdown = new HashMap<>();
            if (eval != null && eval.getPeriodBreakdown() != null) {
                eval.getPeriodBreakdown().forEach(b -> breakdown.put(b.getPeriodId(), b));
            }

            List<PersonPeriod> rows = new ArrayList<>();
            for (KpiPeriod p : group) {
                rows.add(period(userId, p, breakdown.get(p.getId()), levels,
                        scorers.getOrDefault(p.getId(), List.of()),
                        kpis.getOrDefault(p.getId(), List.of())));
            }

            out.add(PersonCycle.builder()
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

    private PersonPeriod period(UUID userId, KpiPeriod p,
                                CycleUserEvaluationResponse.PeriodBreakdown b,
                                List<EvaluationLevel> levels,
                                List<EvaluatorScore> scorers, List<PersonKpiRow> kpis) {
        // Đợt ngoài kỳ không có `periodBreakdown` nào để mượn — tự lấy dòng chấm có hiệu lực.
        Evaluation fallback = b != null ? null : evaluationService.getEffectiveEvaluation(userId, p.getId());
        Double completion = b != null ? b.getCompletionPercent()
                : fallback == null ? null : round1(fallback.getKpiCompletionPercent());
        EvaluationLevel level = LeaderboardService.levelOf(levels, completion);

        return PersonPeriod.builder()
                .periodId(p.getId()).name(p.getName())
                .startDate(p.getStartDate()).endDate(p.getEndDate())
                .selfScore(b != null ? b.getSelfScore() : null)
                .managerScore(b != null ? b.getManagerScore()
                        : fallback == null ? null : round1(fallback.getScore()))
                .quantScore(b != null ? b.getQuantScore()
                        : fallback == null ? null : round1(fallback.getSystemScore()))
                .qualScore(b != null ? b.getQualScore()
                        : fallback == null ? null : round1(fallback.getBehaviorScore()))
                .completionPercent(completion)
                .matrixRating(b != null ? b.getMatrixRating()
                        : fallback == null ? null : fallback.getMatrixRating())
                .ratingName(level == null ? null : level.getName())
                .ratingColor(level == null ? null : level.getColor())
                .evaluators(scorers)
                .kpis(kpis)
                .build();
    }

    /**
     * Gom đợt theo kỳ, giữ nguyên thứ tự thời gian của danh sách vào.
     *
     * <p>{@code kpi_periods.kpi_cycle_id} cho phép null, nên những đợt không thuộc kỳ nào gom thành
     * MỘT nhóm và luôn đứng cuối — không trộn lẫn vào kỳ nào cả.
     */
    static List<List<KpiPeriod>> groupByCycle(List<KpiPeriod> periods) {
        LinkedHashMap<UUID, List<KpiPeriod>> byCycle = new LinkedHashMap<>();
        List<KpiPeriod> loose = new ArrayList<>();
        for (KpiPeriod p : periods) {
            KpiCycle c = p.getKpiCycle();
            if (c == null) loose.add(p);
            else byCycle.computeIfAbsent(c.getId(), k -> new ArrayList<>()).add(p);
        }
        List<List<KpiPeriod>> out = new ArrayList<>(byCycle.values());
        if (!loose.isEmpty()) out.add(loose);
        return out;
    }

    /**
     * Điểm theo TỪNG người chấm cho mọi đợt trong phạm vi — một truy vấn, không hỏi từng đợt một.
     *
     * <p>Trong một đợt xếp theo lần chấm đầu: quản lý trực tiếp chấm trước, cấp trên chấm sau
     * (cùng quy ước {@code SubmissionScoreLedger}).
     */
    private Map<UUID, List<EvaluatorScore>> evaluatorScores(UUID userId, List<UUID> periodIds) {
        Map<String, String> roleNames = new HashMap<>();
        Map<UUID, List<EvaluatorScore>> out = new HashMap<>();

        evaluationRepository.findByUserIdAndKpiPeriodIdIn(userId, periodIds).stream()
                .sorted(Comparator.comparing(Evaluation::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(e -> {
                    UUID evaluatorId = e.getEvaluator() == null ? null : e.getEvaluator().getId();
                    UUID unitId = e.getOrgUnit() == null ? null : e.getOrgUnit().getId();
                    String role = evaluatorId == null || unitId == null ? null
                            : roleNames.computeIfAbsent(evaluatorId + ":" + unitId,
                                    k -> permissionChecker.getBestRoleNameInOrgUnit(evaluatorId, unitId));
                    out.computeIfAbsent(e.getKpiPeriod().getId(), k -> new ArrayList<>())
                            .add(EvaluatorScore.builder()
                                    .evaluatorId(evaluatorId)
                                    .evaluatorName(e.getEvaluator() == null ? null : e.getEvaluator().getFullName())
                                    .evaluatorRoleName(role)
                                    .self(userId.equals(evaluatorId))
                                    .score(round1(e.getScore()))
                                    .systemScore(round1(e.getSystemScore()))
                                    .bscScore(round1(e.getBscScore()))
                                    .behaviorScore(round1(e.getBehaviorScore()))
                                    .kpiCompletionPercent(round1(e.getKpiCompletionPercent()))
                                    .matrixRating(e.getMatrixRating())
                                    .comment(e.getComment())
                                    .evaluatedAt(e.getCreatedAt())
                                    .build());
                });
        return out;
    }

    private Map<UUID, List<PersonKpiRow>> kpisByPeriod(UUID userId, Set<UUID> periodIds) {
        Map<UUID, List<PersonKpiRow>> out = new HashMap<>();
        List<KpiCriteria> all = kpiCriteriaRepository
                .findByUserIdInAssignees(userId, AnalyticsKpiMetrics.SCORING_STATUSES,
                        PageRequest.of(0, KPI_SCAN))
                .getContent();

        for (KpiCriteria k : all) {
            if (k.getKpiPeriod() == null || !periodIds.contains(k.getKpiPeriod().getId())) continue;
            out.computeIfAbsent(k.getKpiPeriod().getId(), x -> new ArrayList<>())
                    .add(PersonKpiRow.builder()
                            .kpiId(k.getId()).name(k.getName())
                            .kpiType(k.getKpiType() == null ? null : k.getKpiType().name())
                            .unit(k.getUnit()).weight(k.getWeight()).targetValue(k.getTargetValue())
                            .actualValue(round1(metrics.actualValue(k, userId, AnalyticsKpiMetrics.Window.ALL, false)))
                            .attainmentPercent(round1(metrics.attainmentPercent(k, userId, AnalyticsKpiMetrics.Window.ALL, false)))
                            .periodId(k.getKpiPeriod().getId())
                            .periodName(k.getKpiPeriod().getName())
                            .status(k.getStatus() == null ? null : k.getStatus().name())
                            .build());
        }
        return out;
    }

    // ============================================================
    // Phụ trợ
    // ============================================================

    private List<KpiPeriod> orderedPeriods(Collection<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return List.of();
        List<KpiPeriod> all = new ArrayList<>(kpiPeriodRepository.findAllById(periodIds));
        all.sort(Comparator.comparing(p -> p.getStartDate() == null ? Instant.EPOCH : p.getStartDate()));
        return all;
    }

    private String unitNameOf(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(UserRoleOrgUnit::getOrgUnit).filter(java.util.Objects::nonNull)
                .map(u -> u.getName()).findFirst().orElse(null);
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
