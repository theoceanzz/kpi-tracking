package com.kpitracking.service;

import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.*;
import com.kpitracking.service.analytics.KpiMetricsCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Analytics service for standalone KPIs (KPIs without a KeyResult).
 * Powers the "KPI của tôi" tab.
 */
@Service
@RequiredArgsConstructor
public class PersonalKpiAnalyticsService {

    private final UserRepository userRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final EvaluationService evaluationService;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    /** Tập đợt liên quan: đợt đang chọn, hoặc tất cả đợt của các KPI. */
    private java.util.Set<UUID> relevantPeriodIds(List<KpiCriteria> kpis, java.util.Collection<UUID> periodIds) {
        if (periodIds != null && !periodIds.isEmpty()) return new java.util.LinkedHashSet<>(periodIds);
        return kpis.stream().map(KpiCriteria::getKpiPeriod).filter(java.util.Objects::nonNull)
                .map(KpiPeriod::getId).collect(Collectors.toSet());
    }

    private List<KpiCriteria> getMyStandaloneKpis(java.util.Collection<UUID> periodIds) {
        User user = getCurrentUser();
        return kpiCriteriaRepository.findApprovedByAssigneeIdWithoutKeyResult(user.getId())
                .stream()
                // KPI thác nước (có parent) không tính tiến độ/hiệu suất cho người được giao.
                // Kết quả của KPI con đã được tự động tổng hợp lên KPI cha
                // (xem aggregateToParentKpi trong KpiSubmissionService) nên KPI cha sẽ phản ánh phần này.
                .filter(kpi -> kpi.getParent() == null)
                // Lọc theo (các) đợt khi người dùng chọn đợt/khoảng đợt cụ thể.
                .filter(kpi -> periodIds == null || periodIds.isEmpty()
                        || (kpi.getKpiPeriod() != null && periodIds.contains(kpi.getKpiPeriod().getId())))
                .collect(Collectors.toList());
    }

    // ── Metrics calculation (identical to PersonalObjectiveAnalyticsService) ──

    private double[] calculateKpiMetrics(KpiCriteria kpi, Instant A, Instant B, Boolean onlyApproved) {
        // KPI cha (decomposition): tiến độ/hiệu suất = bình quân có trọng số chuẩn hoá của các con.
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            double wSum = 0, compSum = 0, perfSum = 0, actualSum = 0;
            boolean anyActive = false;
            for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
                double[] cm = calculateKpiMetrics(child, A, B, onlyApproved);
                if (cm[2] == 0) continue;
                double w = child.getWeight() != null ? child.getWeight() : 0.0;
                if (w <= 0) continue;
                wSum += w;
                compSum += cm[0] * w;
                perfSum += cm[1] * w;
                actualSum += cm[3];
                anyActive = true;
            }
            if (!anyActive || wSum == 0) return new double[]{0, 0, anyActive ? 1 : 0, 0};
            return new double[]{compSum / wSum, perfSum / wSum, 1.0, actualSum};
        }

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null
                ? kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
        Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null
                ? kpi.getKpiPeriod().getEndDate() : Instant.now().plus(365, ChronoUnit.DAYS);

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc   = B != null && B.isBefore(kpiEnd)  ? B : kpiEnd;

        if (startCalc.isAfter(endCalc)) return new double[]{0, 0, 0, 0};

        double totalKpiTime     = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime  = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio        = Math.min(1.0, validFilterTime / totalKpiTime);
        double targetValue      = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValue    = targetValue * timeRatio;

        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !t.isBefore(kpiStart) && (B == null || !t.isAfter(B));
                })
                .collect(Collectors.toList());

        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !t.isBefore(A)) && (B == null || !t.isAfter(B));
                })
                .collect(Collectors.toList());

        boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double completion, performance, actualReturn;
        if (reverse) {
            completion  = KpiMetricsCalculator.reversePercent(complSubs, targetValue);
            performance = KpiMetricsCalculator.reversePercent(perfSubs, targetValue);
            actualReturn = KpiMetricsCalculator.latest(complSubs);
        } else {
            double actualCompletion  = KpiMetricsCalculator.sum(complSubs);
            double actualPerformance = KpiMetricsCalculator.sum(perfSubs);
            // Cap 150%: không KPI nào (kể cả KPI thường) được vượt 150%.
            completion  = targetValue > 0   ? KpiMetricsCalculator.cap((actualCompletion   / targetValue)   * 100) : 0;
            performance = expectedValue > 0 ? KpiMetricsCalculator.cap((actualPerformance  / expectedValue) * 100) : 0;
            actualReturn = actualCompletion;
        }
        return new double[]{completion, performance, 1.0, actualReturn};
    }

    /** Dựng danh sách KPI con (kèm metrics) cho KPI cha/thác nước để FE expand. Trả null nếu không có con. */
    private List<KpiDetail> buildChildDetails(KpiCriteria kpi, Instant from, Instant to, Boolean onlyApproved) {
        List<KpiCriteria> kids = KpiMetricsCalculator.children(kpi);
        if (kids.isEmpty()) return null;
        List<KpiDetail> result = new ArrayList<>();
        for (KpiCriteria child : kids) {
            double[] cm = calculateKpiMetrics(child, from, to, onlyApproved);
            boolean childBonus = Boolean.TRUE.equals(child.getIsBonusKpi());
            result.add(KpiDetail.builder()
                    .kpiId(child.getId())
                    .kpiName(child.getName())
                    .targetValue(child.getTargetValue() != null ? child.getTargetValue() : 1.0)
                    .actualValue(cm[3])
                    .unit(child.getUnit())
                    .progress(childBonus ? null : cm[0])
                    .performance(childBonus ? null : cm[1])
                    .periodStart(child.getKpiPeriod() != null ? child.getKpiPeriod().getStartDate() : null)
                    .periodEnd(child.getKpiPeriod() != null ? child.getKpiPeriod().getEndDate() : null)
                    .periodName(child.getKpiPeriod() != null ? child.getKpiPeriod().getName() : null)
                    .weight(child.getWeight())
                    .assigneeName(KpiMetricsCalculator.assigneeNames(child))
                    .isShared(child.getAssignees() != null && child.getAssignees().size() > 1)
                    .participantCount(child.getAssignees() != null ? child.getAssignees().size() : 1)
                    .isReverseKpi(Boolean.TRUE.equals(child.getIsReverseKpi()))
                    .isBonusKpi(childBonus)
                    .parentId(kpi.getId())
                    .parentRelationType(child.getParentRelationType())
                    .childRelationType(KpiMetricsCalculator.childRelationType(child))
                    .children(buildChildDetails(child, from, to, onlyApproved)) // cây nhiều tầng
                    .build());
        }
        return result;
    }

    // ── Public endpoints ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Metrics getMetrics(Instant from, Instant to, Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        List<KpiCriteria> myKpis = getMyStandaloneKpis(periodIds);
        double totalComp = 0, totalPerf = 0;
        int activeCount = 0, completedCount = 0, runningCount = 0, riskCount = 0;
        Instant now = Instant.now();

        for (KpiCriteria kpi : myKpis) {
            // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính vào số trung bình & các bộ đếm.
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
            double[] m = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (m[2] > 0) {
                totalComp += m[0];
                totalPerf += m[1];
                activeCount++;
                if (m[0] >= 100) completedCount++; else runningCount++;
                Instant kpiEnd = kpi.getEffectiveDeadline();
                if (kpiEnd != null) {
                    long daysLeft = (kpiEnd.toEpochMilli() - now.toEpochMilli()) / (1000 * 60 * 60 * 24);
                    if (daysLeft <= 7 && m[0] < 50) riskCount++;
                }
            }
        }

        // Hiệu suất TB nay tính theo ĐÁNH GIÁ của người trong đợt (không theo KPI).
        Double evalPerf = evaluationService.averagePerformance(
                java.util.List.of(getCurrentUser().getId()), relevantPeriodIds(myKpis, periodIds));

        return Metrics.builder()
                .averageProgress(activeCount > 0 ? totalComp / activeCount : 0)
                .averagePerformance(evalPerf != null ? evalPerf : 0)
                .runningKpis(runningCount)
                .completedKpis(completedCount)
                .riskKpis(riskCount)
                .build();
    }

    @Transactional(readOnly = true)
    public ComboChartData getComboChart(Instant from, Instant to, Boolean onlyApproved, java.util.Collection<UUID> periodIds, String groupBy) {
        // groupBy=PERIOD → mỗi cột = 1 đợt; mặc định TIME → theo khoảng thời gian. Hiệu suất theo đánh giá.
        if ("PERIOD".equalsIgnoreCase(groupBy)) return getComboChartByPeriod(onlyApproved, periodIds);
        return getComboChartByInterval(from, to, onlyApproved, periodIds);
    }

    // Xu hướng THEO ĐỢT: mỗi điểm = 1 đợt; tiến độ = TB tiến độ KPI của đợt, hiệu suất = đánh giá của người trong đợt.
    private ComboChartData getComboChartByPeriod(Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        List<KpiCriteria> myKpis = getMyStandaloneKpis(periodIds);
        UUID userId = getCurrentUser().getId();

        java.util.Map<UUID, KpiPeriod> periodMap = new java.util.LinkedHashMap<>();
        for (KpiCriteria kpi : myKpis) {
            if (kpi.getKpiPeriod() != null) periodMap.putIfAbsent(kpi.getKpiPeriod().getId(), kpi.getKpiPeriod());
        }
        List<KpiPeriod> periods = periodMap.values().stream()
                .sorted(java.util.Comparator.comparing(p -> p.getStartDate() != null ? p.getStartDate() : Instant.EPOCH))
                .collect(Collectors.toList());

        List<ChartPoint> points = new ArrayList<>();
        for (KpiPeriod p : periods) {
            double totalComp = 0; int cnt = 0;
            for (KpiCriteria kpi : myKpis) {
                if (kpi.getKpiPeriod() == null || !p.getId().equals(kpi.getKpiPeriod().getId())) continue;
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                double[] m = calculateKpiMetrics(kpi, p.getStartDate(), p.getEndDate(), onlyApproved);
                if (m[2] > 0) { totalComp += m[0]; cnt++; }
            }
            double avgComp = cnt > 0 ? totalComp / cnt : 0;
            Double perf = evaluationService.getEffectivePerformanceScore(userId, p.getId());
            points.add(ChartPoint.builder()
                    .label(p.getName())
                    .oldItems(0)
                    .newItems(cnt)
                    .completionTrend(Math.round(avgComp * 100.0) / 100.0)
                    .performanceTrend(perf != null ? Math.round(perf * 100.0) / 100.0 : 0)
                    .build());
        }
        return new ComboChartData(points);
    }

    // Xu hướng THEO KHOẢNG THỜI GIAN (tuần/tháng); hiệu suất theo ĐÁNH GIÁ (đồng bộ với KPI đơn vị).
    private ComboChartData getComboChartByInterval(Instant from, Instant to, Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        List<KpiCriteria> myKpis = getMyStandaloneKpis(periodIds);
        UUID userId = getCurrentUser().getId();
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant effectiveTo   = to   != null ? to   : Instant.now();

        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<ChartPoint> points = new ArrayList<>();

        for (IntervalPoint ip : intervalPoints) {
            int oldItems = 0, newItems = 0;
            double totalComp = 0;
            int assignedCount = 0;
            java.util.Set<UUID> evalPeriodIds = new java.util.LinkedHashSet<>();

            for (KpiCriteria kpi : myKpis) {
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                Instant kpiRef = (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null)
                        ? kpi.getKpiPeriod().getStartDate() : kpi.getCreatedAt();
                if (kpiRef != null && kpiRef.isBefore(ip.end)) {
                    assignedCount++;
                    if (kpiRef.isBefore(ip.start)) oldItems++; else newItems++;
                    double[] m = calculateKpiMetrics(kpi, effectiveFrom, ip.end, onlyApproved);
                    totalComp += m[0];
                    if (kpi.getKpiPeriod() != null) evalPeriodIds.add(kpi.getKpiPeriod().getId());
                }
            }

            double avgComp = assignedCount > 0 ? totalComp / assignedCount : 0;
            Double evalPerf = evalPeriodIds.isEmpty() ? null
                    : evaluationService.averagePerformance(java.util.List.of(userId), evalPeriodIds);
            double avgPerf = evalPerf != null ? evalPerf : 0;
            points.add(ChartPoint.builder()
                    .label(ip.label)
                    .oldItems(oldItems)
                    .newItems(newItems)
                    .completionTrend(Math.round(avgComp * 100.0) / 100.0)
                    .performanceTrend(Math.round(avgPerf * 100.0) / 100.0)
                    .build());
        }

        return new ComboChartData(points);
    }

    @Transactional(readOnly = true)
    public PagedKpiDetailResponse getDetailedKpis(
            Instant from, Instant to, Boolean onlyApproved,
            String sortBy, String sortDir,
            String sharedType,
            int page, int size, java.util.Collection<UUID> periodIds) {

        User currentUser = getCurrentUser();
        List<KpiCriteria> myKpis = getMyStandaloneKpis(periodIds);
        List<KpiDetail> details = new ArrayList<>();

        for (KpiCriteria kpi : myKpis) {
            double[] m = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (m[2] == 0) continue;

            boolean isShared  = kpi.getAssignees() != null && kpi.getAssignees().size() > 1;
            double totalTarget = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;

            List<SubmissionHistory> mySubmissions = new ArrayList<>();
            if (kpi.getSubmissions() != null) {
                for (KpiSubmission sub : kpi.getSubmissions()) {
                    boolean validStatus = Boolean.TRUE.equals(onlyApproved)
                            ? sub.getStatus() == SubmissionStatus.APPROVED
                            : (sub.getStatus() == SubmissionStatus.APPROVED || sub.getStatus() == SubmissionStatus.PENDING || sub.getStatus() == SubmissionStatus.REJECTED);
                    if (validStatus
                            && (from == null || !sub.getCreatedAt().isBefore(from))
                            && (to   == null || !sub.getCreatedAt().isAfter(to))
                            && sub.getSubmittedBy() != null && sub.getSubmittedBy().getId().equals(currentUser.getId())) {
                        double subActual   = sub.getActualValue() != null ? sub.getActualValue() : 0.0;
                        double subProgress = Boolean.TRUE.equals(kpi.getIsReverseKpi())
                                ? KpiMetricsCalculator.reversePercent(subActual, totalTarget)
                                : (subActual / totalTarget) * 100;
                        mySubmissions.add(SubmissionHistory.builder()
                                .id(sub.getId())
                                .code("SUB#" + sub.getId().toString().substring(0, 4).toUpperCase())
                                .submitDate(sub.getCreatedAt())
                                .actualValue(subActual)
                                .contributionProgress(subProgress)
                                .performance(subProgress)
                                .status(sub.getStatus().name())
                                .build());
                    }
                }
            }

            List<TeammateProgress> teammates = new ArrayList<>();
            if (isShared && kpi.getAssignees() != null) {
                for (User assignee : kpi.getAssignees()) {
                    if (assignee.getId().equals(currentUser.getId())) continue;
                    List<KpiSubmission> assigneeSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                            .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                    : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                            .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                            .filter(s -> {
                                Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                                Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null
                                        ? kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
                                return !t.isBefore(kpiStart) && (to == null || !t.isAfter(to));
                            })
                            .collect(Collectors.toList());
                    boolean assigneeReverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
                    double assigneeActual = assigneeReverse ? KpiMetricsCalculator.latest(assigneeSubs) : KpiMetricsCalculator.sum(assigneeSubs);
                    double assigneeProgress = assigneeReverse
                            ? KpiMetricsCalculator.reversePercent(assigneeSubs, totalTarget)
                            : (totalTarget > 0 ? (assigneeActual / totalTarget) * 100 : 0);
                    teammates.add(TeammateProgress.builder()
                            .userId(assignee.getId())
                            .fullName(assignee.getFullName())
                            .avatarUrl(assignee.getAvatarUrl())
                            .employeeCode(assignee.getEmployeeCode())
                            .role("Thành viên")
                            .department(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "")
                            .actualValue(assigneeActual)
                            .progress(assigneeProgress)
                            .performance(assigneeProgress)
                            .build());
                }
            }

            // KPI thưởng vẫn được liệt kê nhưng không hiển thị tiến độ/hiệu suất.
            boolean isBonus = Boolean.TRUE.equals(kpi.getIsBonusKpi());

            details.add(KpiDetail.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .targetValue(totalTarget)
                    .actualValue(m[3])
                    .unit(kpi.getUnit())
                    .progress(isBonus ? null : m[0])
                    .performance(isBonus ? null : m[1])
                    .objectiveName("")
                    .objectiveCode("")
                    .keyResultName("")
                    .keyResultCode("")
                    .periodStart(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getStartDate() : null)
                    .periodEnd(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getEndDate() : null)
                    .periodName(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getName() : null)
                    .weight(kpi.getWeight())
                    .assigneeName(KpiMetricsCalculator.assigneeNames(kpi))
                    .isShared(isShared)
                    .participantCount(kpi.getAssignees() != null ? kpi.getAssignees().size() : 1)
                    .isReverseKpi(Boolean.TRUE.equals(kpi.getIsReverseKpi()))
                    .isBonusKpi(isBonus)
                    .parentId(kpi.getParent() != null ? kpi.getParent().getId() : null)
                    .parentRelationType(kpi.getParentRelationType())
                    .childRelationType(KpiMetricsCalculator.childRelationType(kpi))
                    .children(buildChildDetails(kpi, from, to, onlyApproved))
                    .mySubmissions(mySubmissions)
                    .teammates(teammates)
                    .build());
        }

        // Filter
        if ("SHARED".equalsIgnoreCase(sharedType))   details.removeIf(d -> !d.isShared());
        else if ("PERSONAL".equalsIgnoreCase(sharedType)) details.removeIf(d -> d.isShared());

        // Sort
        Comparator<KpiDetail> comparator = null;
        if ("progress".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getProgress() != null ? d.getProgress() : 0.0);
        else if ("performance".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getPerformance() != null ? d.getPerformance() : 0.0);
        else if ("period".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparing(d -> d.getPeriodStart() != null ? d.getPeriodStart() : Instant.EPOCH);
        if (comparator != null && "desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        if (comparator != null) details.sort(comparator);

        // Paginate
        long total = details.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 1;
        int safeStart  = Math.min(page * size, (int) total);
        int safeEnd    = Math.min(safeStart + size, (int) total);

        return PagedKpiDetailResponse.builder()
                .content(details.subList(safeStart, safeEnd))
                .page(page).size(size)
                .totalElements(total).totalPages(totalPages)
                .first(page == 0).last(page >= totalPages - 1)
                .availableObjectives(Collections.emptyList())
                .availableKeyResults(Collections.emptyList())
                .build();
    }

    // ── Chart helpers (identical to PersonalObjectiveAnalyticsService) ────────

    private static class ChartConfig {
        String groupingType; int periods;
        ChartConfig(String g, int p) { groupingType = g; periods = p; }
    }

    private static class IntervalPoint {
        Instant start, end; String label;
        IntervalPoint(Instant s, Instant e, String l) { start = s; end = e; label = l; }
    }

    private ChartConfig determineChartConfig(Instant from, Instant to) {
        long N = Math.max(1, (to.toEpochMilli() - from.toEpochMilli()) / (1000 * 60 * 60 * 24));
        if (N <= 7)    return new ChartConfig("Ngày",  (int) N);
        if (N <= 70)   return new ChartConfig("Tuần",  (int) Math.ceil((double) N / 7.0));
        if (N <= 300)  return new ChartConfig("Tháng", (int) Math.ceil((double) N / 30.0));
        if (N <= 1200) return new ChartConfig("Quý",   (int) Math.ceil((double) N / 90.0));
        return             new ChartConfig("Năm",   (int) Math.ceil((double) N / 365.0));
    }

    private List<IntervalPoint> generateIntervalPoints(Instant from, Instant to) {
        Instant ef = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant et = to   != null ? to   : Instant.now();
        ChartConfig cfg = determineChartConfig(ef, et);
        List<IntervalPoint> pts = new ArrayList<>();
        LocalDate start = ef.atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate end   = et.atZone(ZoneId.systemDefault()).toLocalDate();

        switch (cfg.groupingType) {
            case "Ngày" -> {
                for (LocalDate c = start; !c.isAfter(end); c = c.plusDays(1))
                    pts.add(new IntervalPoint(
                            c.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            c.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            "Ng " + c.getDayOfMonth() + "/" + c.getMonthValue()));
            }
            case "Tuần" -> {
                int w = 1;
                for (LocalDate c = start; c.isBefore(end); c = c.plusWeeks(1), w++) {
                    LocalDate next = c.plusWeeks(1);
                    pts.add(new IntervalPoint(
                            c.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            (next.isAfter(end) ? end.plusDays(1) : next).atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            "Tuần " + w));
                }
            }
            case "Tháng" -> {
                for (LocalDate c = start.withDayOfMonth(1); !c.isAfter(end.withDayOfMonth(1)); c = c.plusMonths(1)) {
                    LocalDate next  = c.plusMonths(1);
                    LocalDate aS    = c.isBefore(start) ? start : c;
                    LocalDate aE    = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                    pts.add(new IntervalPoint(
                            aS.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            aE.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            "Tháng " + c.getMonthValue() + "/" + c.getYear()));
                }
            }
            case "Quý" -> {
                int sqm = ((start.getMonthValue() - 1) / 3) * 3 + 1;
                for (LocalDate c = start.withMonth(sqm).withDayOfMonth(1); !c.isAfter(end); c = c.plusMonths(3)) {
                    LocalDate next = c.plusMonths(3);
                    LocalDate aS   = c.isBefore(start) ? start : c;
                    LocalDate aE   = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                    pts.add(new IntervalPoint(
                            aS.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            aE.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            "Quý " + ((c.getMonthValue() - 1) / 3 + 1) + "/" + c.getYear()));
                }
            }
            default -> {
                for (LocalDate c = start.withDayOfYear(1); !c.isAfter(end); c = c.plusYears(1)) {
                    LocalDate next = c.plusYears(1);
                    LocalDate aS   = c.isBefore(start) ? start : c;
                    LocalDate aE   = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                    pts.add(new IntervalPoint(
                            aS.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            aE.atStartOfDay(ZoneId.systemDefault()).toInstant(),
                            "Năm " + c.getYear()));
                }
            }
        }
        return pts;
    }
}
