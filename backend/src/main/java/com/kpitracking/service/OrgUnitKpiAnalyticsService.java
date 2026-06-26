package com.kpitracking.service;

import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
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
 * Analytics service for standalone KPIs (no KeyResult) scoped to an org unit and its children.
 * Powers the "KPI đơn vị" tab.
 */
@Service
@RequiredArgsConstructor
public class OrgUnitKpiAnalyticsService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private List<OrgUnit> resolveOrgUnitSubtree(UUID orgUnitId) {
        User user = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(user);
        
        if (orgUnitId != null) {
            Optional<OrgUnit> root = orgUnitRepository.findById(orgUnitId);
            if (root.isEmpty()) return Collections.emptyList();
            // Validate that the requested orgUnitId belongs to the user's organization
            if (!root.get().getOrgHierarchyLevel().getOrganization().getId().equals(orgId)) {
                return Collections.emptyList();
            }
            return orgUnitRepository.findSubtree(root.get().getPath(), orgId);
        }
        
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(user.getId(), "DASHBOARD:VIEW");
        if (rootIds.isEmpty()) {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            rootIds = assignments.stream().map(a -> a.getOrgUnit().getId()).distinct().toList();
        }
        if (rootIds.isEmpty()) return Collections.emptyList();
        return orgUnitRepository.findAllInSubtrees(rootIds, orgId);
    }

    private List<KpiCriteria> getStandaloneKpis(UUID orgUnitId) {
        List<OrgUnit> units = resolveOrgUnitSubtree(orgUnitId);
        if (units.isEmpty()) return Collections.emptyList();
        List<UUID> unitIds = units.stream().map(OrgUnit::getId).toList();
        return kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(unitIds);
    }

    /** Khi người dùng chọn một đợt cụ thể, chỉ giữ các KPI thuộc đợt đó. */
    private List<KpiCriteria> applyPeriodFilter(List<KpiCriteria> kpis, UUID periodId) {
        if (periodId == null) return kpis;
        return kpis.stream()
                .filter(k -> k.getKpiPeriod() != null && periodId.equals(k.getKpiPeriod().getId()))
                .collect(Collectors.toList());
    }

    // ── Metrics calculation (same algorithm as PersonalKpiAnalyticsService) ────

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

        double totalKpiTime    = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio       = Math.min(1.0, validFilterTime / totalKpiTime);
        double targetValue     = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValue   = targetValue * timeRatio;

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
    private List<OrgUnitKpiDetail> buildChildDetails(KpiCriteria kpi, Instant from, Instant to, Boolean onlyApproved) {
        List<KpiCriteria> kids = KpiMetricsCalculator.children(kpi);
        if (kids.isEmpty()) return null;
        List<OrgUnitKpiDetail> result = new ArrayList<>();
        for (KpiCriteria child : kids) {
            double[] cm = calculateKpiMetrics(child, from, to, onlyApproved);
            boolean childBonus = Boolean.TRUE.equals(child.getIsBonusKpi());
            result.add(OrgUnitKpiDetail.builder()
                    .kpiId(child.getId())
                    .kpiName(child.getName())
                    .targetValue(child.getTargetValue() != null ? child.getTargetValue() : 1.0)
                    .actualValue(cm[3])
                    .unit(child.getUnit())
                    .progress(childBonus ? null : cm[0])
                    .performance(childBonus ? null : cm[1])
                    .orgUnitId(child.getOrgUnit() != null ? child.getOrgUnit().getId() : null)
                    .orgUnitName(child.getOrgUnit() != null ? child.getOrgUnit().getName() : "")
                    .periodStart(child.getKpiPeriod() != null ? child.getKpiPeriod().getStartDate() : null)
                    .periodEnd(child.getKpiPeriod() != null ? child.getKpiPeriod().getEndDate() : null)
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
    public Metrics getMetrics(UUID orgUnitId, Instant from, Instant to, Boolean onlyApproved, UUID periodId) {
        List<KpiCriteria> kpis = applyPeriodFilter(getStandaloneKpis(orgUnitId), periodId);
        double totalComp = 0, totalPerf = 0;
        int activeCount = 0, completedCount = 0, runningCount = 0, riskCount = 0;
        Instant now = Instant.now();

        for (KpiCriteria kpi : kpis) {
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

        return Metrics.builder()
                .averageProgress(activeCount > 0 ? totalComp / activeCount : 0)
                .averagePerformance(activeCount > 0 ? totalPerf / activeCount : 0)
                .runningKpis(runningCount)
                .completedKpis(completedCount)
                .riskKpis(riskCount)
                .build();
    }

    @Transactional(readOnly = true)
    public ComboChartData getComboChart(UUID orgUnitId, Instant from, Instant to, Boolean onlyApproved, UUID periodId) {
        List<KpiCriteria> kpis = applyPeriodFilter(getStandaloneKpis(orgUnitId), periodId);
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant effectiveTo   = to   != null ? to   : Instant.now();

        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<ChartPoint> points = new ArrayList<>();

        for (IntervalPoint ip : intervalPoints) {
            int oldItems = 0, newItems = 0;
            double totalComp = 0, totalPerf = 0;
            int assignedCount = 0;

            for (KpiCriteria kpi : kpis) {
                // KPI thưởng không tính vào xu hướng tiến độ/hiệu suất.
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                Instant kpiRef = (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null)
                        ? kpi.getKpiPeriod().getStartDate() : kpi.getCreatedAt();
                if (kpiRef != null && kpiRef.isBefore(ip.end)) {
                    assignedCount++;
                    if (kpiRef.isBefore(ip.start)) oldItems++; else newItems++;
                    double[] m = calculateKpiMetrics(kpi, effectiveFrom, ip.end, onlyApproved);
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
    public OrgUnitKpiPagedResponse getDetailedKpis(
            UUID orgUnitId, UUID filterOrgUnitId,
            Instant from, Instant to, Boolean onlyApproved,
            String sortBy, String sortDir,
            String sharedType,
            int page, int size, UUID periodId) {

        List<OrgUnit> subtree = resolveOrgUnitSubtree(orgUnitId);
        if (subtree.isEmpty()) return emptyPagedResponse(page, size);

        List<UUID> allUnitIds = subtree.stream().map(OrgUnit::getId).toList();
        List<KpiCriteria> kpis = applyPeriodFilter(
                kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(allUnitIds), periodId);

        // Build available org unit filter options (only units that actually have KPIs)
        Set<UUID> unitsWithKpis = kpis.stream()
                .filter(k -> k.getOrgUnit() != null)
                .map(k -> k.getOrgUnit().getId())
                .collect(Collectors.toSet());
        List<FilterOption> availableOrgUnits = buildHierarchicalFilterOptions(subtree, unitsWithKpis, getCurrentUserUnitIds());

        // Apply unit filter
        if (filterOrgUnitId != null) {
            kpis = kpis.stream()
                    .filter(k -> k.getOrgUnit() != null && k.getOrgUnit().getId().equals(filterOrgUnitId))
                    .toList();
        }

        List<OrgUnitKpiDetail> details = new ArrayList<>();

        for (KpiCriteria kpi : kpis) {
            double[] m = calculateKpiMetrics(kpi, from, to, onlyApproved);
            if (m[2] == 0) continue;

            boolean isShared   = kpi.getAssignees() != null && kpi.getAssignees().size() > 1;
            double totalTarget = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
            String orgUnitName = kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "";
            UUID   kpiOrgUnitId = kpi.getOrgUnit() != null ? kpi.getOrgUnit().getId() : null;
            // KPI thưởng vẫn được liệt kê nhưng không hiển thị tiến độ/hiệu suất.
            boolean isBonus = Boolean.TRUE.equals(kpi.getIsBonusKpi());

            details.add(OrgUnitKpiDetail.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .targetValue(totalTarget)
                    .actualValue(m[3])
                    .unit(kpi.getUnit())
                    .progress(isBonus ? null : m[0])
                    .performance(isBonus ? null : m[1])
                    .orgUnitId(kpiOrgUnitId)
                    .orgUnitName(orgUnitName)
                    .periodStart(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getStartDate() : null)
                    .periodEnd(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getEndDate() : null)
                    .isShared(isShared)
                    .participantCount(kpi.getAssignees() != null ? kpi.getAssignees().size() : 1)
                    .isReverseKpi(Boolean.TRUE.equals(kpi.getIsReverseKpi()))
                    .isBonusKpi(isBonus)
                    .parentId(kpi.getParent() != null ? kpi.getParent().getId() : null)
                    .parentRelationType(kpi.getParentRelationType())
                    .childRelationType(KpiMetricsCalculator.childRelationType(kpi))
                    .children(buildChildDetails(kpi, from, to, onlyApproved))
                    .build());
        }

        // Filter by shared type
        if ("SHARED".equalsIgnoreCase(sharedType))    details.removeIf(d -> !d.isShared());
        else if ("PERSONAL".equalsIgnoreCase(sharedType)) details.removeIf(OrgUnitKpiDetail::isShared);

        // Sort
        Comparator<OrgUnitKpiDetail> comparator = null;
        if ("progress".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getProgress() != null ? d.getProgress() : 0.0);
        else if ("performance".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparingDouble(d -> d.getPerformance() != null ? d.getPerformance() : 0.0);
        else if ("period".equalsIgnoreCase(sortBy))
            comparator = Comparator.comparing(d -> d.getPeriodStart() != null ? d.getPeriodStart() : Instant.EPOCH);
        if (comparator != null && "desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        if (comparator != null) details.sort(comparator);

        // Paginate
        long total      = details.size();
        int totalPages  = size > 0 ? (int) Math.ceil((double) total / size) : 1;
        int safeStart   = Math.min(page * size, (int) total);
        int safeEnd     = Math.min(safeStart + size, (int) total);

        return OrgUnitKpiPagedResponse.builder()
                .content(details.subList(safeStart, safeEnd))
                .page(page).size(size)
                .totalElements(total).totalPages(totalPages)
                .first(page == 0).last(page >= totalPages - 1)
                .availableOrgUnits(availableOrgUnits)
                .build();
    }

    // ── Drawer ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public OrgUnitKpiDrawerData getKpiDrawerData(UUID kpiId, Instant from, Instant to, Boolean onlyApproved) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI not found: " + kpiId));

        double targetValue  = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        boolean isShared    = kpi.getAssignees() != null && kpi.getAssignees().size() > 1;
        boolean reverseKpi  = Boolean.TRUE.equals(kpi.getIsReverseKpi());

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null
                ? kpi.getKpiPeriod().getStartDate() : Instant.EPOCH;
        Instant kpiEnd   = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null
                ? kpi.getKpiPeriod().getEndDate() : Instant.now().plus(365, ChronoUnit.DAYS);

        // Overall totals
        double[] overall = calculateKpiMetrics(kpi, from, to, onlyApproved);
        double totalActual      = overall[3];
        double totalProgress    = overall[0];
        double teamPerformance  = overall[1];

        // Assignee-level stats for the dual bar chart
        UUID kpiOrgUnitId = kpi.getOrgUnit() != null ? kpi.getOrgUnit().getId() : null;
        List<AssigneeStat> assigneeStats = new ArrayList<>();
        if (kpi.getAssignees() != null) {
            Instant effectiveFrom = from;
            Instant effectiveTo   = to;
            for (User assignee : kpi.getAssignees()) {
                double startCalcMs = effectiveFrom != null && effectiveFrom.isAfter(kpiStart)
                        ? effectiveFrom.toEpochMilli() : kpiStart.toEpochMilli();
                double endCalcMs   = effectiveTo != null && effectiveTo.isBefore(kpiEnd)
                        ? effectiveTo.toEpochMilli() : kpiEnd.toEpochMilli();
                double totalKpiMs  = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
                double timeRatio   = Math.min(1.0, (endCalcMs - startCalcMs) / totalKpiMs);
                double expected    = targetValue * timeRatio;

                List<KpiSubmission> assigneeComplSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                        .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                        .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                        .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return !t.isBefore(kpiStart) && (to == null || !t.isAfter(to)); })
                        .collect(Collectors.toList());

                List<KpiSubmission> assigneePerfSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                        .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                        .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                        .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return (from == null || !t.isBefore(from)) && (to == null || !t.isAfter(to)); })
                        .collect(Collectors.toList());

                double assigneeCompletion = reverseKpi ? KpiMetricsCalculator.latest(assigneeComplSubs) : KpiMetricsCalculator.sum(assigneeComplSubs);
                double assigneeCompletionRate = reverseKpi ? KpiMetricsCalculator.reversePercent(assigneeComplSubs, targetValue)
                        : (targetValue > 0 ? (assigneeCompletion / targetValue) * 100 : 0);
                double assigneePerformanceRate = reverseKpi ? KpiMetricsCalculator.reversePercent(assigneePerfSubs, targetValue)
                        : (expected > 0 ? (KpiMetricsCalculator.sum(assigneePerfSubs) / expected) * 100 : 0);

                // Resolve org unit and role for this assignee
                List<UserRoleOrgUnit> assignments = kpiOrgUnitId != null
                        ? userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(assignee.getId(), kpiOrgUnitId)
                        : Collections.emptyList();
                if (assignments.isEmpty())
                    assignments = userRoleOrgUnitRepository.findByUserId(assignee.getId());
                String assigneeOrgUnitName = assignments.isEmpty() ? null : assignments.get(0).getOrgUnit().getName();
                String assigneeRoleName    = assignments.isEmpty() ? null : assignments.get(0).getRole().getName();

                assigneeStats.add(AssigneeStat.builder()
                        .userId(assignee.getId())
                        .fullName(assignee.getFullName())
                        .avatarUrl(assignee.getAvatarUrl())
                        .orgUnitName(assigneeOrgUnitName)
                        .roleName(assigneeRoleName)
                        .actualValue(assigneeCompletion)
                        .completionRate(assigneeCompletionRate)
                        .performanceRate(assigneePerformanceRate)
                        .build());
            }
        }

        // Time-series chart data
        Instant ef = from != null ? from : Instant.now().minus(180, ChronoUnit.DAYS);
        Instant et = to   != null ? to   : Instant.now();
        List<IntervalPoint> pts = generateIntervalPoints(ef, et);
        List<DrawerChartPoint> chartPoints = new ArrayList<>();

        List<User> assigneeList = kpi.getAssignees() != null ? new ArrayList<>(kpi.getAssignees()) : Collections.emptyList();

        for (IntervalPoint ip : pts) {
            // Team cumulative submissions up to ip.end
            List<KpiSubmission> teamCumSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                    .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                            : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                    .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return !t.isBefore(kpiStart) && !t.isAfter(ip.end); })
                    .collect(Collectors.toList());

            double periodActual = kpi.getSubmissions() == null ? 0 : kpi.getSubmissions().stream()
                    .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                            : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                    .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return !t.isBefore(ip.start) && !t.isAfter(ip.end); })
                    .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0).sum();

            double totalKpiMs  = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
            double periodMs    = ip.end.toEpochMilli() - ip.start.toEpochMilli();
            double ratio       = Math.min(1.0, periodMs / totalKpiMs);
            double expectedPeriod = targetValue * ratio;
            // KPI ngược: actual hiển thị = bài nộp mới nhất; hiệu suất = reversePercent
            double cumActual = reverseKpi ? KpiMetricsCalculator.latest(teamCumSubs) : KpiMetricsCalculator.sum(teamCumSubs);
            double perf        = reverseKpi ? KpiMetricsCalculator.reversePercent(teamCumSubs, targetValue)
                    : (expectedPeriod > 0 ? (periodActual / expectedPeriod) * 100 : 0);

            // Per-assignee values for this interval
            Map<String, AssigneeChartValues> assigneeValues = new HashMap<>();
            for (User assignee : assigneeList) {
                String uid = assignee.getId().toString();
                List<KpiSubmission> aCumSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                        .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                        .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                        .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return !t.isBefore(kpiStart) && !t.isAfter(ip.end); })
                        .collect(Collectors.toList());
                double aPeriod = kpi.getSubmissions() == null ? 0 : kpi.getSubmissions().stream()
                        .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                        .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                        .filter(s -> { Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(); return !t.isBefore(ip.start) && !t.isAfter(ip.end); })
                        .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0).sum();
                double aCum  = reverseKpi ? KpiMetricsCalculator.latest(aCumSubs) : KpiMetricsCalculator.sum(aCumSubs);
                double aPerf = reverseKpi ? KpiMetricsCalculator.reversePercent(aCumSubs, targetValue)
                        : (expectedPeriod > 0 ? (aPeriod / expectedPeriod) * 100 : 0);
                assigneeValues.put(uid, AssigneeChartValues.builder()
                        .actual(aCum)
                        .performance(Math.round(aPerf * 100.0) / 100.0)
                        .build());
            }

            chartPoints.add(DrawerChartPoint.builder()
                    .label(ip.label)
                    .targetValue(targetValue)
                    .teamTotalActual(cumActual)
                    .teamPerformance(Math.round(perf * 100.0) / 100.0)
                    .assigneeValues(assigneeValues)
                    .build());
        }

        List<AssigneeInfo> availableAssignees = assigneeList.stream()
                .map(a -> AssigneeInfo.builder().userId(a.getId().toString()).fullName(a.getFullName()).build())
                .toList();

        // Top submissions
        List<KpiSubmission> qualifyingSubmissions = kpi.getSubmissions() == null ? Collections.emptyList() :
                kpi.getSubmissions().stream()
                        .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                                : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                        .filter(s -> {
                            Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                            return (from == null || !t.isBefore(from)) && (to == null || !t.isAfter(to));
                        })
                        .toList();
        int subCount = Math.max(1, qualifyingSubmissions.size());
        double expectedPerSub = targetValue / subCount;

        List<SubmissionStat> topSubmissions = qualifyingSubmissions.stream()
                .map(s -> {
                    double actualVal = s.getActualValue() != null ? s.getActualValue() : 0.0;
                    double contribPct = reverseKpi ? KpiMetricsCalculator.reversePercent(actualVal, targetValue)
                            : (targetValue > 0 ? (actualVal / targetValue) * 100 : 0);
                    double perf       = reverseKpi ? KpiMetricsCalculator.reversePercent(actualVal, targetValue)
                            : (expectedPerSub > 0 ? (actualVal / expectedPerSub) * 100 : 0);
                    User submitter    = s.getSubmittedBy();
                    String name       = submitter != null ? submitter.getFullName() : "—";
                    Instant subTime   = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    String datePart   = subTime != null
                            ? " (" + subTime.atZone(ZoneId.systemDefault()).toLocalDate().getDayOfMonth()
                            + "/" + subTime.atZone(ZoneId.systemDefault()).toLocalDate().getMonthValue() + ")"
                            : "";
                    return SubmissionStat.builder()
                            .label(name + datePart)
                            .submitterName(name)
                            .actualValue(actualVal)
                            .contributionProgress(Math.round(contribPct * 100.0) / 100.0)
                            .performance(Math.round(perf * 100.0) / 100.0)
                            .submittedAt(subTime)
                            .build();
                })
                .sorted(Comparator.comparingDouble(SubmissionStat::getActualValue).reversed())
                .limit(10)
                .toList();

        return OrgUnitKpiDrawerData.builder()
                .kpiName(kpi.getName())
                .unit(kpi.getUnit())
                .isShared(isShared)
                .targetValue(targetValue)
                .totalActualValue(totalActual)
                .totalProgress(totalProgress)
                .teamPerformance(teamPerformance)
                .chartPoints(chartPoints)
                .assigneeStats(assigneeStats)
                .availableAssignees(availableAssignees)
                .topSubmissions(topSubmissions)
                .build();
    }

    private OrgUnitKpiPagedResponse emptyPagedResponse(int page, int size) {
        return OrgUnitKpiPagedResponse.builder()
                .content(Collections.emptyList())
                .page(page).size(size)
                .totalElements(0).totalPages(0)
                .first(true).last(true)
                .availableOrgUnits(Collections.emptyList())
                .build();
    }

    // ── Response DTOs ─────────────────────────────────────────────────────────

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class OrgUnitKpiDetail {
        private UUID kpiId;
        private String kpiName;
        private Double targetValue;
        private Double actualValue;
        private String unit;
        private Double progress;
        private Double performance;
        private UUID orgUnitId;
        private String orgUnitName;
        private Instant periodStart;
        private Instant periodEnd;
        private boolean isShared;
        private int participantCount;

        // Nhận diện loại KPI (tag: thường/thưởng/ngược/cha/con/thác nước) + KPI con kèm metrics
        private Boolean isReverseKpi;
        private Boolean isBonusKpi;
        private UUID parentId;
        private com.kpitracking.enums.KpiParentRelationType parentRelationType;
        private com.kpitracking.enums.KpiParentRelationType childRelationType;
        private List<OrgUnitKpiDetail> children;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class OrgUnitKpiPagedResponse {
        private List<OrgUnitKpiDetail> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
        private List<FilterOption> availableOrgUnits;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AssigneeStat {
        private UUID userId;
        private String fullName;
        private String avatarUrl;
        private String orgUnitName;
        private String roleName;
        private double actualValue;
        private double completionRate;
        private double performanceRate;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AssigneeChartValues {
        private double actual;
        private double performance;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AssigneeInfo {
        private String userId;
        private String fullName;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class DrawerChartPoint {
        private String label;
        private double targetValue;
        private double teamTotalActual;
        private double teamPerformance;
        private Map<String, AssigneeChartValues> assigneeValues;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SubmissionStat {
        private String label;
        private String submitterName;
        private double actualValue;
        private double contributionProgress;
        private double performance;
        private Instant submittedAt;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class OrgUnitKpiDrawerData {
        private String kpiName;
        private String unit;
        private boolean isShared;
        private double targetValue;
        private double totalActualValue;
        private double totalProgress;
        private double teamPerformance;
        private List<DrawerChartPoint> chartPoints;
        private List<AssigneeStat> assigneeStats;
        private List<AssigneeInfo> availableAssignees;
        private List<SubmissionStat> topSubmissions;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class UnitRiskRow {
        private UUID unitId;
        private String unitName;
        private int totalKpis;
        private int overdueCount;
        private double overdueRate;
        private double avgProgress;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class UnitRiskPagedResponse {
        private List<UnitRiskRow> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MemberRiskRow {
        private UUID userId;
        private String fullName;
        private String avatarUrl;
        private String orgUnitName;
        private int totalKpis;
        private int overdueCount;
        private double overdueRate;
        private double avgProgress;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MemberRiskPagedResponse {
        private List<MemberRiskRow> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
        private List<FilterOption> availableOrgUnits;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class OverdueKpiForUnit {
        private UUID kpiId;
        private String kpiName;
        private Instant deadline;
        private List<String> assigneeNames;
        private double targetValue;
        private String unit;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MemberSubmissionItem {
        private double actualValue;
        private Instant submittedAt;
        private String status;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class OverdueKpiForMember {
        private UUID kpiId;
        private String kpiName;
        private Instant deadline;
        private double targetValue;
        private String unit;
        private List<MemberSubmissionItem> submissions;
    }

    // ── Risk methods ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UnitRiskPagedResponse getUnitRisks(UUID orgUnitId, Instant from, Instant to, Boolean onlyApproved, int page, int size, String sortBy, String sortDir, UUID periodId) {
        List<OrgUnit> subtree = resolveOrgUnitSubtree(orgUnitId);
        if (subtree.isEmpty()) return UnitRiskPagedResponse.builder()
            .content(Collections.emptyList()).page(page).size(size)
            .totalElements(0).totalPages(0).first(true).last(true).build();

        List<UnitRiskRow> rows = new ArrayList<>();

        for (OrgUnit unit : subtree) {
            List<KpiCriteria> unitKpis = applyPeriodFilter(
                    kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(List.of(unit.getId())), periodId);
            if (unitKpis.isEmpty()) continue;

            int totalKpis = unitKpis.size();
            int overdueCount = 0;
            double totalProgress = 0;

            for (KpiCriteria kpi : unitKpis) {
                double[] m = calculateKpiMetrics(kpi, from, to, onlyApproved);
                totalProgress += m[0];
                if (isKpiOverdueOverall(kpi)) overdueCount++;
            }

            double avgProgress = totalProgress / totalKpis;
            double overdueRate = (double) overdueCount / totalKpis * 100;
            rows.add(UnitRiskRow.builder()
                .unitId(unit.getId()).unitName(unit.getName())
                .totalKpis(totalKpis).overdueCount(overdueCount)
                .overdueRate(Math.round(overdueRate * 100.0) / 100.0)
                .avgProgress(Math.round(avgProgress * 100.0) / 100.0)
                .build());
        }

        Comparator<UnitRiskRow> comp = switch (sortBy != null ? sortBy.toLowerCase() : "") {
            case "overduecount" -> Comparator.comparingInt(UnitRiskRow::getOverdueCount);
            case "overduerate"  -> Comparator.comparingDouble(UnitRiskRow::getOverdueRate);
            default             -> Comparator.comparingDouble(UnitRiskRow::getAvgProgress);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comp = comp.reversed();
        rows.sort(comp);

        int total = rows.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 1;
        int s = Math.min(page * size, total), e = Math.min(s + size, total);
        return UnitRiskPagedResponse.builder()
            .content(rows.subList(s, e)).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1).build();
    }

    @Transactional(readOnly = true)
    public MemberRiskPagedResponse getMemberRisks(UUID orgUnitId, UUID filterOrgUnitId, Instant from, Instant to, Boolean onlyApproved, int page, int size, String sortBy, String sortDir, UUID periodId) {
        List<OrgUnit> subtree = resolveOrgUnitSubtree(orgUnitId);
        if (subtree.isEmpty()) return MemberRiskPagedResponse.builder()
            .content(Collections.emptyList()).page(page).size(size)
            .totalElements(0).totalPages(0).first(true).last(true)
            .availableOrgUnits(Collections.emptyList()).build();

        List<UUID> allUnitIds = subtree.stream().map(OrgUnit::getId).toList();
        List<KpiCriteria> allKpis = applyPeriodFilter(
                kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(allUnitIds), periodId);

        Set<UUID> unitsWithKpis = allKpis.stream()
            .filter(k -> k.getOrgUnit() != null && k.getAssignees() != null && !k.getAssignees().isEmpty())
            .map(k -> k.getOrgUnit().getId()).collect(Collectors.toSet());
        Set<UUID> currentUserUnitIds = getCurrentUserUnitIds();
        List<FilterOption> availableOrgUnits = buildHierarchicalFilterOptions(subtree, unitsWithKpis, currentUserUnitIds);

        List<KpiCriteria> filtered = filterOrgUnitId != null
            ? allKpis.stream().filter(k -> k.getOrgUnit() != null && k.getOrgUnit().getId().equals(filterOrgUnitId)).toList()
            : allKpis;

        Map<UUID, MemberRiskAccumulator> accum = new java.util.LinkedHashMap<>();

        for (KpiCriteria kpi : filtered) {
            if (kpi.getAssignees() == null || kpi.getAssignees().isEmpty()) continue;
            double target = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
            String unitName = kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "—";

            boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
            for (User assignee : kpi.getAssignees()) {
                List<KpiSubmission> assigneeSubs = kpi.getSubmissions() == null ? Collections.emptyList() : kpi.getSubmissions().stream()
                    .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                    .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                    .filter(s -> {
                        Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                        return (from == null || !t.isBefore(from)) && (to == null || !t.isAfter(to));
                    })
                    .collect(Collectors.toList());
                double completion = reverse ? KpiMetricsCalculator.reversePercent(assigneeSubs, target)
                        : (target > 0 ? (KpiMetricsCalculator.sum(assigneeSubs) / target) * 100 : 0);
                boolean overdue = isKpiOverdueForUser(kpi, assignee.getId());

                MemberRiskAccumulator a = accum.computeIfAbsent(assignee.getId(),
                    id -> new MemberRiskAccumulator(id, assignee.getFullName(), assignee.getAvatarUrl(), unitName));
                a.totalKpis++;
                a.totalProgress += completion;
                if (overdue) a.overdueCount++;
            }
        }

        List<MemberRiskRow> rows = accum.values().stream().map(a -> {
            double avg = a.totalKpis > 0 ? a.totalProgress / a.totalKpis : 0;
            double rate = a.totalKpis > 0 ? (double) a.overdueCount / a.totalKpis * 100 : 0;
            return MemberRiskRow.builder()
                .userId(a.userId).fullName(a.fullName).avatarUrl(a.avatarUrl).orgUnitName(a.orgUnitName)
                .totalKpis(a.totalKpis).overdueCount(a.overdueCount)
                .overdueRate(Math.round(rate * 100.0) / 100.0)
                .avgProgress(Math.round(avg * 100.0) / 100.0)
                .build();
        }).collect(Collectors.toList());

        Comparator<MemberRiskRow> comp = switch (sortBy != null ? sortBy.toLowerCase() : "") {
            case "overduecount" -> Comparator.comparingInt(MemberRiskRow::getOverdueCount);
            case "overduerate"  -> Comparator.comparingDouble(MemberRiskRow::getOverdueRate);
            default             -> Comparator.comparingDouble(MemberRiskRow::getAvgProgress);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comp = comp.reversed();
        rows.sort(comp);

        int total = rows.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 1;
        int s = Math.min(page * size, total), e = Math.min(s + size, total);
        return MemberRiskPagedResponse.builder()
            .content(rows.subList(s, e)).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1)
            .availableOrgUnits(availableOrgUnits).build();
    }

    @Transactional(readOnly = true)
    public List<OverdueKpiForUnit> getUnitOverdueKpis(UUID unitId) {
        List<KpiCriteria> kpis = kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(List.of(unitId));
        List<OverdueKpiForUnit> result = new ArrayList<>();
        for (KpiCriteria kpi : kpis) {
            if (!isKpiOverdueOverall(kpi)) continue;
            Instant kpiEnd = kpi.getEffectiveDeadline();
            List<String> assigneeNames = kpi.getAssignees() == null ? Collections.emptyList()
                    : kpi.getAssignees().stream().map(User::getFullName).toList();
            result.add(OverdueKpiForUnit.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .deadline(kpiEnd)
                    .assigneeNames(assigneeNames)
                    .targetValue(kpi.getTargetValue() != null ? kpi.getTargetValue() : 0.0)
                    .unit(kpi.getUnit())
                    .build());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<OverdueKpiForMember> getMemberOverdueKpis(UUID userId, UUID orgUnitId) {
        List<OrgUnit> subtree = resolveOrgUnitSubtree(orgUnitId);
        if (subtree.isEmpty()) return Collections.emptyList();
        List<UUID> unitIds = subtree.stream().map(OrgUnit::getId).toList();
        List<KpiCriteria> allKpis = kpiCriteriaRepository.findApprovedWithoutKeyResultByOrgUnitIds(unitIds);
        List<OverdueKpiForMember> result = new ArrayList<>();
        for (KpiCriteria kpi : allKpis) {
            if (kpi.getAssignees() == null) continue;
            boolean assignedToUser = kpi.getAssignees().stream().anyMatch(a -> a.getId().equals(userId));
            if (!assignedToUser) continue;
            if (!isKpiOverdueForUser(kpi, userId)) continue;
            Instant kpiEnd = kpi.getEffectiveDeadline();
            List<MemberSubmissionItem> submissions = kpi.getSubmissions() == null ? Collections.emptyList()
                    : kpi.getSubmissions().stream()
                        .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(userId))
                        .filter(s -> s.getStatus() == SubmissionStatus.APPROVED
                                || s.getStatus() == SubmissionStatus.PENDING
                                || s.getStatus() == SubmissionStatus.REJECTED)
                        .sorted(Comparator.comparing(s -> {
                            Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                            return t != null ? t : Instant.EPOCH;
                        }))
                        .map(s -> {
                            Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                            return MemberSubmissionItem.builder()
                                    .actualValue(s.getActualValue() != null ? s.getActualValue() : 0.0)
                                    .submittedAt(t)
                                    .status(s.getStatus() != null ? s.getStatus().name() : "")
                                    .build();
                        }).toList();
            result.add(OverdueKpiForMember.builder()
                    .kpiId(kpi.getId())
                    .kpiName(kpi.getName())
                    .deadline(kpiEnd)
                    .targetValue(kpi.getTargetValue() != null ? kpi.getTargetValue() : 0.0)
                    .unit(kpi.getUnit())
                    .submissions(submissions)
                    .build());
        }
        return result;
    }

    private List<FilterOption> buildHierarchicalFilterOptions(List<OrgUnit> subtree, Set<UUID> eligibleIds, Set<UUID> currentUserUnitIds) {
        List<OrgUnit> eligible = subtree.stream()
            .filter(u -> eligibleIds.contains(u.getId()))
            .sorted(Comparator.comparing(OrgUnit::getPath))
            .toList();
        if (eligible.isEmpty()) return Collections.emptyList();
        int minSlashes = eligible.stream()
            .mapToInt(u -> (int) u.getPath().chars().filter(c -> c == '/').count())
            .min().orElse(0);
        return eligible.stream().map(u -> {
            int depth = (int) u.getPath().chars().filter(c -> c == '/').count() - minSlashes;
            String displayName = currentUserUnitIds.contains(u.getId()) ? u.getName() + " (hiện tại)" : u.getName();
            return FilterOption.builder().code(u.getId().toString()).name(displayName).depth(depth).build();
        }).toList();
    }

    private Set<UUID> getCurrentUserUnitIds() {
        User user = getCurrentUser();
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
        return assignments.stream().map(a -> a.getOrgUnit().getId()).collect(Collectors.toSet());
    }

    private boolean isKpiOverdueOverall(KpiCriteria kpi) {
        Instant kpiEnd = kpi.getEffectiveDeadline();
        if (kpiEnd == null) return false;
        if (kpi.getSubmissions() == null || kpi.getSubmissions().isEmpty()) return false;
        return kpi.getSubmissions().stream()
            .filter(s -> s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED)
            .map(s -> s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt())
            .filter(java.util.Objects::nonNull)
            .max(Comparator.naturalOrder())
            .map(lastTime -> lastTime.isAfter(kpiEnd))
            .orElse(false);
    }

    private boolean isKpiOverdueForUser(KpiCriteria kpi, UUID userId) {
        Instant kpiEnd = kpi.getEffectiveDeadline();
        if (kpiEnd == null) return false;
        if (kpi.getSubmissions() == null || kpi.getSubmissions().isEmpty()) return false;
        return kpi.getSubmissions().stream()
            .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(userId))
            .filter(s -> s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED)
            .map(s -> s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt())
            .filter(java.util.Objects::nonNull)
            .max(Comparator.naturalOrder())
            .map(lastTime -> lastTime.isAfter(kpiEnd))
            .orElse(false);
    }

    private static class MemberRiskAccumulator {
        UUID userId; String fullName; String avatarUrl; String orgUnitName;
        int totalKpis = 0; int overdueCount = 0; double totalProgress = 0.0;
        MemberRiskAccumulator(UUID id, String name, String avatar, String unit) {
            this.userId = id; this.fullName = name; this.avatarUrl = avatar; this.orgUnitName = unit;
        }
    }

    // ── Chart helpers ─────────────────────────────────────────────────────────

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
                    LocalDate next = c.plusMonths(1);
                    LocalDate aS   = c.isBefore(start) ? start : c;
                    LocalDate aE   = next.isAfter(end.plusDays(1)) ? end.plusDays(1) : next;
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
