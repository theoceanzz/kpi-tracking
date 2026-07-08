package com.kpitracking.service;

import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.*;
import com.kpitracking.service.analytics.KpiMetricsCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonalObjectiveAnalyticsService {

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

    private List<KpiCriteria> getMyActiveKpis(java.util.Collection<UUID> periodIds) {
        User user = getCurrentUser();
        return kpiCriteriaRepository.findApprovedByAssigneeIdWithKeyResult(user.getId())
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

    private double[] calculateKpiMetrics(KpiCriteria kpi, Instant A, Instant B, Boolean onlyApproved) {
        // KPI cha (decomposition): tiến độ/hiệu suất = bình quân có trọng số chuẩn hoá của các con.
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            return weightedChildMetrics(kpi, A, B, onlyApproved);
        }

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null ?
                           kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
        Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null ? 
                         kpi.getKpiPeriod().getEndDate() : Instant.now().plus(365, ChronoUnit.DAYS);

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc = B != null && B.isBefore(kpiEnd) ? B : kpiEnd;

        if (startCalc.isAfter(endCalc)) return new double[]{0, 0, 0, 0}; // 0 = completion, 1 = performance, 2 = active flag, 3 = actual

        double totalKpiTime = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio = Math.min(1.0, validFilterTime / totalKpiTime);

        double targetValue = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValueFilter = targetValue * timeRatio;

        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                             (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !submissionTime.isBefore(kpiStart) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                             (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !submissionTime.isBefore(A)) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double completion, performance, actualReturn;
        if (reverse) {
            completion  = KpiMetricsCalculator.reversePercent(complSubs, targetValue);
            performance = KpiMetricsCalculator.reversePercent(perfSubs, targetValue);
            actualReturn = KpiMetricsCalculator.latest(complSubs);
        } else {
            double actualCompletionAccumulated = KpiMetricsCalculator.sum(complSubs);
            double actualPerformanceFilter = KpiMetricsCalculator.sum(perfSubs);
            // Cap 150%: không KPI nào (kể cả KPI thường) được vượt 150%.
            completion = targetValue > 0 ? KpiMetricsCalculator.cap((actualCompletionAccumulated / targetValue) * 100) : 0;
            performance = expectedValueFilter > 0 ? KpiMetricsCalculator.cap((actualPerformanceFilter / expectedValueFilter) * 100) : 0;
            actualReturn = actualCompletionAccumulated;
        }

        return new double[]{completion, performance, 1.0, actualReturn};
    }

    /** Bình quân có trọng số chuẩn hoá tiến độ/hiệu suất của các KPI con decomposition (toàn đội). */
    private double[] weightedChildMetrics(KpiCriteria kpi, Instant A, Instant B, Boolean onlyApproved) {
        double wSum = 0, compSum = 0, perfSum = 0, actualSum = 0;
        boolean anyActive = false;
        for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
            double[] cm = calculateKpiMetrics(child, A, B, onlyApproved);
            if (cm[2] == 0) continue; // con không active trong cửa sổ thời gian
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

    @Transactional(readOnly = true)
    public Metrics getMetrics(Instant from, Instant to, Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        List<KpiCriteria> myKpis = getMyActiveKpis(periodIds);
        double totalComp = 0;
        double totalPerf = 0;
        int activeCount = 0;
        int completedCount = 0;
        int runningCount = 0;
        int riskCount = 0;

        Instant now = Instant.now();

        for (KpiCriteria kpi : myKpis) {
            // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính vào số trung bình & các bộ đếm.
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
            double[] metrics = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (metrics[2] > 0) {
                totalComp += metrics[0];
                totalPerf += metrics[1];
                activeCount++;
                
                if (metrics[0] >= 100) {
                    completedCount++;
                } else {
                    runningCount++;
                }

                // Check risk (progress < 50% and close to deadline within 7 days or overdue)
                Instant kpiEnd = kpi.getEffectiveDeadline();
                if (kpiEnd != null) {
                    long daysLeft = (kpiEnd.toEpochMilli() - now.toEpochMilli()) / (1000 * 60 * 60 * 24);
                    if (daysLeft <= 7 && metrics[0] < 50) {
                        riskCount++;
                    }
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

    // Xu hướng THEO ĐỢT: tiến độ = TB tiến độ KPI của đợt, hiệu suất = đánh giá của người trong đợt.
    private ComboChartData getComboChartByPeriod(Boolean onlyApproved, java.util.Collection<UUID> periodIds) {
        List<KpiCriteria> myKpis = getMyActiveKpis(periodIds);
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
        List<KpiCriteria> myKpis = getMyActiveKpis(periodIds);
        UUID userId = getCurrentUser().getId();
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();

        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<ChartPoint> points = new ArrayList<>();

        for (IntervalPoint ip : intervalPoints) {
            int oldItems = 0;
            int newItems = 0;
            double totalComp = 0;
            int assignedCount = 0;
            java.util.Set<UUID> evalPeriodIds = new java.util.LinkedHashSet<>();

            for (KpiCriteria kpi : myKpis) {
                // KPI thưởng không tính vào xu hướng tiến độ/hiệu suất.
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                Instant kpiRef = (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null)
                        ? kpi.getKpiPeriod().getStartDate()
                        : kpi.getCreatedAt();
                if (kpiRef != null && kpiRef.isBefore(ip.end)) {
                    assignedCount++;
                    if (kpiRef.isBefore(ip.start)) {
                        oldItems++;
                    } else {
                        newItems++;
                    }

                    double[] metrics = calculateKpiMetrics(kpi, effectiveFrom, ip.end, onlyApproved);
                    totalComp += metrics[0];
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
            String objectiveCode, String keyResultCode, String sharedType,
            int page, int size, java.util.Collection<UUID> periodIds) {
        User currentUser = getCurrentUser();
        List<KpiCriteria> myKpis = getMyActiveKpis(periodIds);

        // Build filter options from the full unfiltered list (for dropdown menus)
        Map<String, String> objMap = new LinkedHashMap<>();
        Map<String, String> krMap  = new LinkedHashMap<>();
        for (KpiCriteria kpi : myKpis) {
            KeyResult kr  = kpi.getKeyResult();
            Objective obj = kr != null ? kr.getObjective() : null;
            if (obj != null && obj.getCode() != null) objMap.put(obj.getCode(), obj.getName());
            if (kr  != null && kr.getCode()  != null) krMap .put(kr.getCode(),  kr.getName());
        }
        List<FilterOption> availableObjectives  = objMap.entrySet().stream()
                .map(e -> FilterOption.builder().code(e.getKey()).name(e.getValue()).build())
                .collect(Collectors.toList());
        List<FilterOption> availableKeyResults  = krMap.entrySet().stream()
                .map(e -> FilterOption.builder().code(e.getKey()).name(e.getValue()).build())
                .collect(Collectors.toList());

        List<KpiDetail> details = new ArrayList<>();

        for (KpiCriteria kpi : myKpis) {
            double[] metrics = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (metrics[2] == 0) continue;

            boolean isShared = kpi.getAssignees() != null && kpi.getAssignees().size() > 1;

            List<SubmissionHistory> mySubmissions = new ArrayList<>();
            List<TeammateProgress> teammates = new ArrayList<>();

            double totalTarget = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;

            if (kpi.getSubmissions() != null) {
                for (KpiSubmission sub : kpi.getSubmissions()) {
                    boolean isValidStatus = Boolean.TRUE.equals(onlyApproved) ? sub.getStatus() == SubmissionStatus.APPROVED :
                        (sub.getStatus() == SubmissionStatus.APPROVED || sub.getStatus() == SubmissionStatus.PENDING || sub.getStatus() == SubmissionStatus.REJECTED);

                    if (isValidStatus && (from == null || !sub.getCreatedAt().isBefore(from)) && (to == null || !sub.getCreatedAt().isAfter(to))) {
                        if (sub.getSubmittedBy() != null && sub.getSubmittedBy().getId().equals(currentUser.getId())) {
                            double subActual = sub.getActualValue() != null ? sub.getActualValue() : 0.0;
                            double subProgress = Boolean.TRUE.equals(kpi.getIsReverseKpi())
                                    ? KpiMetricsCalculator.reversePercent(subActual, totalTarget)
                                    : (subActual / totalTarget) * 100;
                            mySubmissions.add(SubmissionHistory.builder()
                                    .id(sub.getId())
                                    .code("SUB#" + sub.getId().toString().substring(0, 4).toUpperCase())
                                    .submitDate(sub.getCreatedAt())
                                    .actualValue(subActual)
                                    .contributionProgress(subProgress)
                                    // Không set performance: hiệu suất theo bài nộp trùng với "Đóng góp" → bỏ hiển thị.
                                    .status(sub.getStatus().name())
                                    .build());
                        }
                    }
                }
            }

            if (isShared) {
                for (User assignee : kpi.getAssignees()) {
                    if (assignee.getId().equals(currentUser.getId())) continue;

                    List<KpiSubmission> assigneeSubs = kpi.getSubmissions() == null ? java.util.Collections.emptyList() :
                        kpi.getSubmissions().stream()
                            .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                                 (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                            .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                            .filter(s -> {
                                Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                                return !submissionTime.isBefore(kpi.getKpiPeriod().getStartDate()) && (to == null || !submissionTime.isAfter(to));
                            })
                            .collect(Collectors.toList());

                    boolean assigneeReverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
                    double assigneeActual = assigneeReverse ? KpiMetricsCalculator.latest(assigneeSubs) : KpiMetricsCalculator.sum(assigneeSubs);
                    double assigneeProgress = assigneeReverse
                            ? KpiMetricsCalculator.reversePercent(assigneeSubs, totalTarget)
                            : (totalTarget > 0 ? (assigneeActual / totalTarget) * 100 : 0);

                    // Hiệu suất đồng đội = điểm ĐÁNH GIÁ đại diện của họ trong đợt của KPI (không phải tiến độ).
                    Double assigneePerf = kpi.getKpiPeriod() != null
                            ? evaluationService.getEffectivePerformanceScore(assignee.getId(), kpi.getKpiPeriod().getId())
                            : null;

                    teammates.add(TeammateProgress.builder()
                            .userId(assignee.getId())
                            .fullName(assignee.getFullName())
                            .avatarUrl(assignee.getAvatarUrl())
                            .employeeCode(assignee.getEmployeeCode())
                            .role("Thành viên")
                            .department(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "")
                            .actualValue(assigneeActual)
                            .progress(assigneeProgress)
                            .performance(assigneePerf)
                            .build());
                }
            }

            KeyResult kr  = kpi.getKeyResult();
            Objective obj = kr != null ? kr.getObjective() : null;

            // KPI thưởng vẫn được liệt kê nhưng không hiển thị tiến độ/hiệu suất.
            boolean isBonus = Boolean.TRUE.equals(kpi.getIsBonusKpi());

            details.add(KpiDetail.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .targetValue(totalTarget)
                    .actualValue(metrics[3])
                    .unit(kpi.getUnit())
                    .progress(isBonus ? null : metrics[0])
                    .performance(isBonus ? null : metrics[1])
                    .objectiveName(obj != null ? obj.getName() : "N/A")
                    .objectiveCode(obj != null ? obj.getCode() : "N/A")
                    .keyResultName(kr != null ? kr.getName() : "N/A")
                    .keyResultCode(kr != null ? kr.getCode() : "N/A")
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
        if (objectiveCode != null && !objectiveCode.isBlank())
            details.removeIf(d -> !objectiveCode.equals(d.getObjectiveCode()));
        if (keyResultCode != null && !keyResultCode.isBlank())
            details.removeIf(d -> !keyResultCode.equals(d.getKeyResultCode()));
        if ("SHARED".equalsIgnoreCase(sharedType))
            details.removeIf(d -> !d.isShared());
        else if ("PERSONAL".equalsIgnoreCase(sharedType))
            details.removeIf(d -> d.isShared());

        // Sort
        Comparator<KpiDetail> comparator = null;
        if ("progress".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getProgress() != null ? d.getProgress() : 0.0);
        else if ("performance".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getPerformance() != null ? d.getPerformance() : 0.0);
        else if ("period".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparing(d -> d.getPeriodStart() != null ? d.getPeriodStart() : Instant.EPOCH);
        if (comparator != null && "desc".equalsIgnoreCase(sortDir))
            comparator = comparator.reversed();
        if (comparator != null)
            details.sort(comparator);

        // Paginate
        long total = details.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 1;
        int safeStart = Math.min(page * size, (int) total);
        int safeEnd   = Math.min(safeStart + size, (int) total);
        List<KpiDetail> pageContent = details.subList(safeStart, safeEnd);

        return PagedKpiDetailResponse.builder()
                .content(pageContent)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages(totalPages)
                .first(page == 0)
                .last(page >= totalPages - 1)
                .availableObjectives(availableObjectives)
                .availableKeyResults(availableKeyResults)
                .build();
    }

    @Transactional(readOnly = true)
    public DrawerData getKpiDrawerData(UUID kpiId, Instant from, Instant to, Boolean onlyApproved) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI not found"));

        boolean isShared = kpi.getAssignees() != null && kpi.getAssignees().size() > 1;
        double target = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;

        double[] myMetrics = calculateKpiMetricsForUser(kpi, currentUser.getId(), from, to, onlyApproved);
        double[] teamMetrics = calculateKpiMetrics(kpi, from, to, onlyApproved);

        // Calculate Multi-axis chart data over time
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        
        List<MultiAxisPoint> points = new ArrayList<>();
        List<TeammateLine> availableTeammates = new ArrayList<>();
        List<ContributionData> contributions = new ArrayList<>();

        if (kpi.getAssignees() != null) {
            for (User assignee : kpi.getAssignees()) {
                if (!assignee.getId().equals(currentUser.getId())) {
                    availableTeammates.add(TeammateLine.builder().userId(assignee.getId()).fullName(assignee.getFullName()).build());
                }
                
                double userActual = calculateKpiMetricsForUser(kpi, assignee.getId(), null, effectiveTo, onlyApproved)[3];
                contributions.add(ContributionData.builder()
                        .userId(assignee.getId())
                        .fullName(assignee.getFullName())
                        .actualValue(userActual)
                        .contributionPercentage(teamMetrics[3] > 0 ? (userActual / teamMetrics[3]) * 100 : 0)
                        .build());
            }
        }

        for (IntervalPoint ip : intervalPoints) {
            double teamTotalActual = calculateKpiMetrics(kpi, effectiveFrom, ip.end, onlyApproved)[3];
            double myActual = calculateKpiMetricsForUser(kpi, currentUser.getId(), effectiveFrom, ip.end, onlyApproved)[3];
            double myPerf = calculateKpiMetricsForUser(kpi, currentUser.getId(), effectiveFrom, ip.end, onlyApproved)[1];
            
            Map<String, TeammateValues> teammateValuesMap = new HashMap<>();
            if (kpi.getAssignees() != null) {
                for (User assignee : kpi.getAssignees()) {
                    if (!assignee.getId().equals(currentUser.getId())) {
                        double tActual = calculateKpiMetricsForUser(kpi, assignee.getId(), effectiveFrom, ip.end, onlyApproved)[3];
                        double tPerf = calculateKpiMetricsForUser(kpi, assignee.getId(), effectiveFrom, ip.end, onlyApproved)[1];
                        teammateValuesMap.put(assignee.getId().toString(), TeammateValues.builder().actual(tActual).performance(tPerf).build());
                    }
                }
            }

            points.add(MultiAxisPoint.builder()
                    .label(ip.label)
                    .targetValue(target)
                    .teamTotalActual(teamTotalActual)
                    .myActual(myActual)
                    .myPerformance(myPerf)
                    .teammateValues(teammateValuesMap)
                    .build());
        }

        KeyResult kr = kpi.getKeyResult();
        Objective obj = kr != null ? kr.getObjective() : null;

        return DrawerData.builder()
                .kpiName(kpi.getName())
                .krName(kr != null ? kr.getName() : "")
                .krCode(kr != null ? kr.getCode() : "")
                .objName(obj != null ? obj.getName() : "")
                .objCode(obj != null ? obj.getCode() : "")
                .isShared(isShared)
                .unit(kpi.getUnit())
                .targetValue(target)
                .myActualValue(myMetrics[3])
                .myProgress(myMetrics[0])
                .totalActualValue(teamMetrics[3])
                .totalProgress(teamMetrics[0])
                .myPerformance(myMetrics[1])
                .teamPerformance(teamMetrics[1])
                .chartData(MultiAxisChartData.builder().points(points).availableTeammates(availableTeammates).build())
                .contributions(contributions)
                .build();
    }

    private double[] calculateKpiMetricsForUser(KpiCriteria kpi, UUID userId, Instant A, Instant B, Boolean onlyApproved) {
        // KPI cha (decomposition): bình quân có trọng số chuẩn hoá của các con (theo người dùng).
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            double wSum = 0, compSum = 0, perfSum = 0, actualSum = 0;
            boolean anyActive = false;
            for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
                double[] cm = calculateKpiMetricsForUser(child, userId, A, B, onlyApproved);
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

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null ?
                           kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
        Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null ? 
                         kpi.getKpiPeriod().getEndDate() : Instant.now().plus(365, ChronoUnit.DAYS);

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc = B != null && B.isBefore(kpiEnd) ? B : kpiEnd;

        if (startCalc.isAfter(endCalc)) return new double[]{0, 0, 0, 0}; 

        double totalKpiTime = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio = Math.min(1.0, validFilterTime / totalKpiTime);

        double targetValue = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        
        // If shared, user's expected target might be targetValue / participant count.
        // Assuming equal distribution if not specified.
        double userTargetValue = kpi.getAssignees() != null && kpi.getAssignees().size() > 0 ? targetValue / kpi.getAssignees().size() : targetValue;
        double expectedValueFilter = userTargetValue * timeRatio;

        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                             (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(userId))
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !submissionTime.isBefore(kpiStart) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                             (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(userId))
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !submissionTime.isBefore(A)) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double completion, performance, actualReturn;
        if (reverse) {
            completion  = KpiMetricsCalculator.reversePercent(complSubs, userTargetValue);
            performance = KpiMetricsCalculator.reversePercent(perfSubs, userTargetValue);
            actualReturn = KpiMetricsCalculator.latest(complSubs);
        } else {
            double actualCompletionAccumulated = KpiMetricsCalculator.sum(complSubs);
            double actualPerformanceFilter = KpiMetricsCalculator.sum(perfSubs);
            completion = userTargetValue > 0 ? KpiMetricsCalculator.cap((actualCompletionAccumulated / userTargetValue) * 100) : 0;
            performance = expectedValueFilter > 0 ? KpiMetricsCalculator.cap((actualPerformanceFilter / expectedValueFilter) * 100) : 0;
            actualReturn = actualCompletionAccumulated;
        }

        return new double[]{completion, performance, 1.0, actualReturn};
    }

    private static class ChartConfig {
        String groupingType;
        int periods;

        ChartConfig(String groupingType, int periods) {
            this.groupingType = groupingType;
            this.periods = periods;
        }
    }

    private ChartConfig determineChartConfig(Instant from, Instant to) {
        long N = Math.max(1, (to.toEpochMilli() - from.toEpochMilli()) / (1000 * 60 * 60 * 24));
        
        String groupingType;
        int periods;
        
        if (N <= 7) {
            groupingType = "Ngày";
            periods = (int) N;
        } else if (N <= 70) {
            groupingType = "Tuần";
            periods = (int) Math.ceil((double) N / 7.0);
        } else if (N <= 300) {
            groupingType = "Tháng";
            periods = (int) Math.ceil((double) N / 30.0);
        } else if (N <= 1200) {
            groupingType = "Quý";
            periods = (int) Math.ceil((double) N / 90.0);
        } else {
            groupingType = "Năm";
            periods = (int) Math.ceil((double) N / 365.0);
        }
        
        return new ChartConfig(groupingType, periods);
    }

    private static class IntervalPoint {
        Instant start;
        Instant end;
        String label;
        IntervalPoint(Instant s, Instant e, String l) { start = s; end = e; label = l; }
    }

    private List<IntervalPoint> generateIntervalPoints(Instant from, Instant to) {
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, java.time.temporal.ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        
        ChartConfig config = determineChartConfig(effectiveFrom, effectiveTo);
        String groupingType = config.groupingType;
        
        List<IntervalPoint> intervalPoints = new ArrayList<>();
        LocalDate start = effectiveFrom.atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate end = effectiveTo.atZone(ZoneId.systemDefault()).toLocalDate();
        
        if ("Ngày".equals(groupingType)) {
            LocalDate curr = start;
            while (!curr.isAfter(end)) {
                Instant pStart = curr.atStartOfDay(ZoneId.systemDefault()).toInstant();
                Instant pEnd = curr.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
                String label = "Ng " + curr.getDayOfMonth() + "/" + curr.getMonthValue();
                intervalPoints.add(new IntervalPoint(pStart, pEnd, label));
                curr = curr.plusDays(1);
            }
        } else if ("Tuần".equals(groupingType)) {
            LocalDate curr = start;
            int weekIdx = 1;
            while (curr.isBefore(end)) {
                LocalDate next = curr.plusWeeks(1);
                Instant pStart = curr.atStartOfDay(ZoneId.systemDefault()).toInstant();
                Instant pEnd = (next.isAfter(end) ? end.plusDays(1) : next).atStartOfDay(ZoneId.systemDefault()).toInstant();
                String label = "Tuần " + weekIdx;
                intervalPoints.add(new IntervalPoint(pStart, pEnd, label));
                curr = next;
                weekIdx++;
            }
        } else if ("Tháng".equals(groupingType)) {
            LocalDate curr = start.withDayOfMonth(1);
            while (!curr.isAfter(end.withDayOfMonth(1))) {
                LocalDate next = curr.plusMonths(1);
                
                LocalDate activeStart = curr.isBefore(start) ? start : curr;
                LocalDate activeEnd = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                
                Instant pStart = activeStart.atStartOfDay(ZoneId.systemDefault()).toInstant();
                Instant pEnd = activeEnd.atStartOfDay(ZoneId.systemDefault()).toInstant();
                
                String label = "Tháng " + curr.getMonthValue() + "/" + curr.getYear();
                intervalPoints.add(new IntervalPoint(pStart, pEnd, label));
                curr = next;
            }
        } else if ("Quý".equals(groupingType)) {
            int startQuarterMonth = ((start.getMonthValue() - 1) / 3) * 3 + 1;
            LocalDate curr = start.withMonth(startQuarterMonth).withDayOfMonth(1);
            while (!curr.isAfter(end)) {
                LocalDate next = curr.plusMonths(3);
                
                LocalDate activeStart = curr.isBefore(start) ? start : curr;
                LocalDate activeEnd = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                
                Instant pStart = activeStart.atStartOfDay(ZoneId.systemDefault()).toInstant();
                Instant pEnd = activeEnd.atStartOfDay(ZoneId.systemDefault()).toInstant();
                
                String label = "Quý " + ((curr.getMonthValue() - 1) / 3 + 1) + "/" + curr.getYear();
                intervalPoints.add(new IntervalPoint(pStart, pEnd, label));
                curr = next;
            }
        } else { // Năm
            LocalDate curr = start.withDayOfYear(1);
            while (!curr.isAfter(end)) {
                LocalDate next = curr.plusYears(1);
                
                LocalDate activeStart = curr.isBefore(start) ? start : curr;
                LocalDate activeEnd = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
                
                Instant pStart = activeStart.atStartOfDay(ZoneId.systemDefault()).toInstant();
                Instant pEnd = activeEnd.atStartOfDay(ZoneId.systemDefault()).toInstant();
                
                String label = "Năm " + curr.getYear();
                intervalPoints.add(new IntervalPoint(pStart, pEnd, label));
                curr = next;
            }
        }
        
        return intervalPoints;
    }
}
