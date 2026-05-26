package com.kpitracking.service;

import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.*;
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

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private List<KpiCriteria> getMyStandaloneKpis() {
        User user = getCurrentUser();
        return kpiCriteriaRepository.findApprovedByAssigneeIdWithoutKeyResult(user.getId());
    }

    // ── Metrics calculation (identical to PersonalObjectiveAnalyticsService) ──

    private double[] calculateKpiMetrics(KpiCriteria kpi, Instant A, Instant B, Boolean onlyApproved) {
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

        double actualCompletion = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !t.isBefore(kpiStart) && (B == null || !t.isAfter(B));
                })
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();

        double actualPerformance = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !t.isBefore(A)) && (B == null || !t.isAfter(B));
                })
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();

        double completion   = targetValue > 0   ? (actualCompletion   / targetValue)   * 100 : 0;
        double performance  = expectedValue > 0 ? (actualPerformance  / expectedValue) * 100 : 0;
        return new double[]{completion, performance, 1.0, actualCompletion};
    }

    // ── Public endpoints ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Metrics getMetrics(Instant from, Instant to, Boolean onlyApproved) {
        List<KpiCriteria> myKpis = getMyStandaloneKpis();
        double totalComp = 0, totalPerf = 0;
        int activeCount = 0, completedCount = 0, runningCount = 0, riskCount = 0;
        Instant now = Instant.now();

        for (KpiCriteria kpi : myKpis) {
            double[] m = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (m[2] > 0) {
                totalComp += m[0];
                totalPerf += m[1];
                activeCount++;
                if (m[0] >= 100) completedCount++; else runningCount++;
                Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null
                        ? kpi.getKpiPeriod().getEndDate() : null;
                if (kpiEnd != null) {
                    long daysLeft = (kpiEnd.toEpochMilli() - now.toEpochMilli()) / (1000 * 60 * 60 * 24);
                    if (daysLeft <= 7 && m[0] < 50) riskCount++;
                }
            }
        }

        return Metrics.builder()
                .averageProgress(activeCount > 0 ? totalComp / activeCount : 0)
                .averagePerformance(activeCount > 0 ? totalPerf / activeCount : 0)
                .runningKpis(runningCount)
                .completedKpis(completedCount)
                .riskKpis(riskCount)
                .build();
    }

    @Transactional(readOnly = true)
    public ComboChartData getComboChart(Instant from, Instant to, Boolean onlyApproved) {
        List<KpiCriteria> myKpis = getMyStandaloneKpis();
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant effectiveTo   = to   != null ? to   : Instant.now();

        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<ChartPoint> points = new ArrayList<>();

        for (IntervalPoint ip : intervalPoints) {
            Instant pStart = ip.start;
            Instant pEnd   = ip.end;
            int oldItems = 0, newItems = 0;
            double totalComp = 0, totalPerf = 0;
            int assignedCount = 0;

            for (KpiCriteria kpi : myKpis) {
                Instant kpiRef = (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null)
                        ? kpi.getKpiPeriod().getStartDate() : kpi.getCreatedAt();
                if (kpiRef != null && kpiRef.isBefore(pEnd)) {
                    assignedCount++;
                    if (kpiRef.isBefore(pStart)) oldItems++; else newItems++;
                    double[] m = calculateKpiMetrics(kpi, effectiveFrom, pEnd, onlyApproved);
                    totalComp += m[0];
                    totalPerf += m[1];
                }
            }

            double avgComp = assignedCount > 0 ? totalComp / assignedCount : 0;
            double avgPerf = assignedCount > 0 ? totalPerf / assignedCount : 0;
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
            int page, int size) {

        User currentUser = getCurrentUser();
        List<KpiCriteria> myKpis = getMyStandaloneKpis();
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
                        double subProgress = (subActual / totalTarget) * 100;
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
                    double assigneeActual = kpi.getSubmissions() == null ? 0 : kpi.getSubmissions().stream()
                            .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                    : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                            .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                            .filter(s -> {
                                Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                                Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null
                                        ? kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
                                return !t.isBefore(kpiStart) && (to == null || !t.isAfter(to));
                            })
                            .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                            .sum();
                    teammates.add(TeammateProgress.builder()
                            .userId(assignee.getId())
                            .fullName(assignee.getFullName())
                            .avatarUrl(assignee.getAvatarUrl())
                            .employeeCode(assignee.getEmployeeCode())
                            .role("Thành viên")
                            .department(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "")
                            .actualValue(assigneeActual)
                            .progress((assigneeActual / totalTarget) * 100)
                            .performance((assigneeActual / totalTarget) * 100)
                            .build());
                }
            }

            details.add(KpiDetail.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .targetValue(totalTarget)
                    .actualValue(m[3])
                    .unit(kpi.getUnit())
                    .progress(m[0])
                    .performance(m[1])
                    .objectiveName("")
                    .objectiveCode("")
                    .keyResultName("")
                    .keyResultCode("")
                    .periodStart(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getStartDate() : null)
                    .periodEnd(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getEndDate() : null)
                    .isShared(isShared)
                    .participantCount(kpi.getAssignees() != null ? kpi.getAssignees().size() : 1)
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
