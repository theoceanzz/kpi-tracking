package com.kpitracking.service;

import com.kpitracking.dto.response.stats.SubordinateDetailsResponses;
import com.kpitracking.dto.response.stats.SubordinateStatsResponses;
import com.kpitracking.dto.response.stats.SubordinateStatsResponses.*;
import com.kpitracking.dto.response.stats.SubordinateDetailsResponses.*;
import com.kpitracking.dto.response.stats.ScopedDashboardResponse;
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
import java.time.ZoneOffset;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubordinateAnalyticsService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final ObjectiveRepository objectiveRepository;
    private final PermissionChecker permissionChecker;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final KeyResultRepository keyResultRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;

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

    private List<UUID> getSubordinateOrgUnitIds() {
        User user = getCurrentUser();
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(user.getId(), "DASHBOARD:VIEW");
        if (rootIds.isEmpty()) {
            // Fallback: get units where user is assigned
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            rootIds = assignments.stream().map(a -> a.getOrgUnit().getId()).toList();
        }
        UUID orgId = getCurrentUserOrganizationId(user);
        List<OrgUnit> authorizedUnits = orgUnitRepository.findAllInSubtrees(rootIds, orgId);
        return authorizedUnits.stream().map(OrgUnit::getId).toList();
    }

    private List<Objective> getObjectivesInScope() {
        List<UUID> orgUnitIds = getSubordinateOrgUnitIds();
        if (orgUnitIds.isEmpty()) return Collections.emptyList();
        return objectiveRepository.findByOrgUnitIdIn(orgUnitIds);
    }

    /**
     * Tiến độ/hiệu suất của một KPI theo cửa sổ [A,B]; phần tử [2] là cờ active (0 = không active).
     * KPI cha (decomposition) lấy bình quân có trọng số chuẩn hoá tiến độ/hiệu suất của các con.
     */
    private double[] kpiCompletionPerformance(KpiCriteria kpi, Instant objStartFallback, Instant objEndFallback,
                                              Instant A, Instant B, Boolean onlyApproved) {
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            double wSum = 0, compSum = 0, perfSum = 0;
            boolean anyActive = false;
            for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
                double w = child.getWeight() != null && child.getWeight() > 0 ? child.getWeight() : 0.0;
                if (w <= 0) continue;
                double[] cm = kpiCompletionPerformance(child, objStartFallback, objEndFallback, A, B, onlyApproved);
                if (cm[2] == 0) continue;
                wSum += w;
                compSum += cm[0] * w;
                perfSum += cm[1] * w;
                anyActive = true;
            }
            if (!anyActive || wSum == 0) return new double[]{0, 0, anyActive ? 1 : 0};
            return new double[]{compSum / wSum, perfSum / wSum, 1.0};
        }

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null
                ? kpi.getKpiPeriod().getStartDate() : objStartFallback;
        Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null
                ? kpi.getKpiPeriod().getEndDate() : objEndFallback;

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc = B != null && B.isBefore(kpiEnd) ? B : kpiEnd;
        if (startCalc.isAfter(endCalc)) return new double[]{0, 0, 0};

        double totalKpiTime = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio = Math.min(1.0, validFilterTime / totalKpiTime);
        double targetValue = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValueFilter = targetValue * timeRatio;

        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !t.isBefore(kpiStart) && (B == null || !t.isAfter(B));
                })
                .toList();

        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED
                        : (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                .filter(s -> {
                    Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !t.isBefore(A)) && (B == null || !t.isAfter(B));
                })
                .toList();

        boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double completion = reverse
                ? KpiMetricsCalculator.reversePercent(complSubs, targetValue)
                : (targetValue > 0 ? (KpiMetricsCalculator.sum(complSubs) / targetValue) * 100 : 0);
        double performance = reverse
                ? KpiMetricsCalculator.reversePercent(perfSubs, targetValue)
                : (expectedValueFilter > 0 ? (KpiMetricsCalculator.sum(perfSubs) / expectedValueFilter) * 100 : 0);
        return new double[]{completion, performance, 1.0};
    }

    private double[] calculateObjectiveMetrics(Objective obj, Instant A, Instant B, Boolean onlyApproved) {
        if (obj.getKeyResults() == null || obj.getKeyResults().isEmpty()) {
            return new double[]{0.0, 0.0};
        }

        double totalKrCompletion = 0;
        double totalKrPerformance = 0;
        int activeKrCount = 0;

        for (KeyResult kr : obj.getKeyResults()) {
            if (kr.getKpis() == null || kr.getKpis().isEmpty()) continue;

            double sumWeightedCompletion = 0;
            double sumWeightedPerformance = 0;
            double sumWeight = 0;

            Instant objStartFallback = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
            Instant objEndFallback = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

            for (KpiCriteria kpi : kr.getKpis()) {
                // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                if (kpi.getParent() != null) continue;
                // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;

                double[] cp = kpiCompletionPerformance(kpi, objStartFallback, objEndFallback, A, B, onlyApproved);
                if (cp[2] == 0) continue; // Not active in this filter

                double completion = cp[0];
                double performance = cp[1];
                double weight = kpi.getWeight() != null && kpi.getWeight() > 0 ? kpi.getWeight() : 1.0;

                sumWeightedCompletion += (completion * weight);
                sumWeightedPerformance += (performance * weight);
                sumWeight += weight;
            }

            if (sumWeight > 0) {
                totalKrCompletion += (sumWeightedCompletion / sumWeight);
                totalKrPerformance += (sumWeightedPerformance / sumWeight);
                activeKrCount++;
            }
        }

        if (activeKrCount == 0) return new double[]{0.0, 0.0};
        return new double[]{totalKrCompletion / activeKrCount, totalKrPerformance / activeKrCount};
    }

    @Transactional(readOnly = true)
    public MetricValueResponse getCompletionRate(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        if (objectives.isEmpty()) return new MetricValueResponse(0.0);

        double total = 0;
        int count = 0;
        for (Objective obj : objectives) {
            double[] metrics = calculateObjectiveMetrics(obj, from, to, onlyApproved);
            total += metrics[0];
            count++;
        }
        return new MetricValueResponse(count > 0 ? total / count : 0.0);
    }

    @Transactional(readOnly = true)
    public MetricValueResponse getPerformanceRate(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        if (objectives.isEmpty()) return new MetricValueResponse(0.0);

        double total = 0;
        int count = 0;
        for (Objective obj : objectives) {
            double[] metrics = calculateObjectiveMetrics(obj, from, to, onlyApproved);
            total += metrics[1];
            count++;
        }
        return new MetricValueResponse(count > 0 ? total / count : 0.0);
    }

    @Transactional(readOnly = true)
    public CompletedCountResponse getCompletedCount(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        if (objectives.isEmpty()) return new CompletedCountResponse(0, 0);

        int completed = 0;
        for (Objective obj : objectives) {
            double[] metrics = calculateObjectiveMetrics(obj, from, to, onlyApproved);
            if (metrics[0] >= 100.0) {
                completed++;
            }
        }
        return new CompletedCountResponse(completed, objectives.size());
    }

    @Transactional(readOnly = true)
    public CountResponse getAtRiskCount(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        if (objectives.isEmpty()) return new CountResponse(0);

        int riskCount = 0;
        Instant now = Instant.now();
        for (Objective obj : objectives) {
            double[] metrics = calculateObjectiveMetrics(obj, from, to, onlyApproved);
            // Low progress (< 50%) and close deadline (within 7 days)
            boolean lowProgress = metrics[0] < 50.0;
            boolean closeDeadline = false;
            
            Instant deadline = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null;
            if (deadline != null) {
                long daysLeft = (deadline.toEpochMilli() - now.toEpochMilli()) / (1000 * 60 * 60 * 24);
                if (daysLeft >= 0 && daysLeft <= 7) {
                    closeDeadline = true;
                }
            }
            if (lowProgress && closeDeadline) {
                riskCount++;
            }
        }
        return new CountResponse(riskCount);
    }

    @Transactional(readOnly = true)
    public CountResponse getPersonnelCount() {
        List<UUID> orgUnitIds = getSubordinateOrgUnitIds();
        if (orgUnitIds.isEmpty()) return new CountResponse(0);

        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByOrgUnitIdIn(orgUnitIds);
        long count = assignments.stream()
                .filter(a -> !permissionChecker.isGlobalAdmin(a.getUser().getId()))
                .map(a -> a.getUser().getId())
                .distinct()
                .count();

        return new CountResponse((int) count);
    }

    @Transactional(readOnly = true)
    public ComboChartResponse getComboChart(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        
        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, java.time.temporal.ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        
        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<ComboChartResponse.ChartPoint> points = new ArrayList<>();
        
        for (IntervalPoint ip : intervalPoints) {
            Instant pStart = ip.start;
            Instant pEnd = ip.end;
            String label = ip.label;

            int oldObjs = 0;
            int newObjs = 0;
            double totalComp = 0;
            double totalPerf = 0;
            int actObjs = 0;

            for (Objective obj : objectives) {
                if (obj.getCreatedAt() == null) continue;
                
                boolean isActive = true;
                if (!obj.getCreatedAt().isBefore(pEnd)) isActive = false;
                if (obj.getDeletedAt() != null && obj.getDeletedAt().isBefore(pEnd)) isActive = false;
                
                if (isActive) {
                    if (obj.getCreatedAt().isBefore(pStart)) {
                        oldObjs++;
                    } else {
                        newObjs++;
                    }
                    
                    double[] metrics = calculateObjectiveMetrics(obj, effectiveFrom, pEnd, onlyApproved);
                    totalComp += metrics[0];
                    totalPerf += metrics[1];
                    actObjs++;
                }
            }

            double avgComp = actObjs > 0 ? totalComp / actObjs : 0;
            double avgPerf = actObjs > 0 ? totalPerf / actObjs : 0;

            points.add(ComboChartResponse.ChartPoint.builder()
                    .label(label)
                    .oldItems(oldObjs)
                    .newItems(newObjs)
                    .completionTrend(Math.round(avgComp * 100.0) / 100.0)
                    .performanceTrend(Math.round(avgPerf * 100.0) / 100.0)
                    .build());
        }

        return new ComboChartResponse(points);
    }

    private ObjectiveDetailedDto buildObjectiveDetailedDto(Objective obj, Instant A, Instant B, Boolean onlyApproved) {
        List<KeyResultDetailedDto> krDtos = new ArrayList<>();
        double totalObjCompletion = 0;
        double totalObjPerformance = 0;
        int activeKrCount = 0;
        int completedKrs = 0;

        if (obj.getKeyResults() != null) {
            for (KeyResult kr : obj.getKeyResults()) {
                if (kr.getKpis() == null || kr.getKpis().isEmpty()) continue;

                List<KpiDetailedDto> kpiDtos = new ArrayList<>();
                double sumWeightedCompletion = 0;
                double sumWeightedPerformance = 0;
                double sumWeight = 0;

                Instant objStartFallback = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
                Instant objEndFallback = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

                for (KpiCriteria kpi : kr.getKpis()) {
                    // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                    if (kpi.getParent() != null) continue;

                    boolean isBonus = Boolean.TRUE.equals(kpi.getIsBonusKpi());
                    double[] cp = kpiCompletionPerformance(kpi, objStartFallback, objEndFallback, A, B, onlyApproved);
                    if (cp[2] == 0) continue; // Not active in this filter

                    double completion = cp[0];
                    double performance = cp[1];
                    double weight = kpi.getWeight() != null && kpi.getWeight() > 0 ? kpi.getWeight() : 1.0;

                    // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính vào bình quân (vẫn được liệt kê).
                    if (!isBonus) {
                        sumWeightedCompletion += (completion * weight);
                        sumWeightedPerformance += (performance * weight);
                        sumWeight += weight;
                    }

                    String kpiStatus = "CHƯA NỘP";
                    boolean hasSubmissions = kpi.getSubmissions() != null && !kpi.getSubmissions().isEmpty();
                    if (kpi.getAssignees() == null || kpi.getAssignees().isEmpty()) {
                        kpiStatus = "CHƯA ĐƯỢC GIAO";
                    } else if (hasSubmissions) {
                        kpiStatus = kpi.getSubmissions().stream()
                            .max(Comparator.comparing(KpiSubmission::getCreatedAt))
                            .map(s -> {
                                if (s.getStatus() == SubmissionStatus.APPROVED) return "ĐÃ DUYỆT";
                                if (s.getStatus() == SubmissionStatus.PENDING) return "CHỜ DUYỆT";
                                if (s.getStatus() == SubmissionStatus.REJECTED) return "TỪ CHỐI";
                                return s.getStatus().name();
                            })
                            .orElse("CHƯA NỘP");
                    }

                    Double finalPerformance = (isBonus || !hasSubmissions) ? null : performance;

                    // Map participants and submissions
                    List<SubordinateDetailsResponses.KpiParticipantDto> participantDtos = new ArrayList<>();
                    double totalTarget = kpi.getTargetValue() != null ? kpi.getTargetValue() : 0.0;
                    if (totalTarget == 0) totalTarget = 1.0;
                    
                    if (kpi.getAssignees() != null) {
                        for (User assignee : kpi.getAssignees()) {
                            List<SubordinateDetailsResponses.KpiSubmissionDto> assigneeSubs = new ArrayList<>();
                            double assigneeActual = 0;
                            
                            double assigneeProgress;
                            if (kpi.getSubmissions() != null) {
                                List<KpiSubmission> assigneeValidSubs = kpi.getSubmissions().stream()
                                    .filter(s -> Boolean.TRUE.equals(onlyApproved) ? s.getStatus() == SubmissionStatus.APPROVED :
                                         (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING || s.getStatus() == SubmissionStatus.REJECTED))
                                    .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(assignee.getId()))
                                    .toList();
                                assigneeSubs = assigneeValidSubs.stream()
                                    .map(s -> {
                                        String subByName = s.getSubmittedBy() != null ? s.getSubmittedBy().getFullName() : "";
                                        String subByCode = s.getSubmittedBy() != null ?
                                            (s.getSubmittedBy().getEmployeeCode() != null ? s.getSubmittedBy().getEmployeeCode() : s.getSubmittedBy().getEmail()) : "";
                                        return SubordinateDetailsResponses.KpiSubmissionDto.builder()
                                            .id(s.getId())
                                            .actualValue(s.getActualValue())
                                            .note(s.getNote())
                                            .status(s.getStatus().name())
                                            .createdAt(s.getCreatedAt())
                                            .submittedByName(subByName)
                                            .submittedByCode(subByCode)
                                            .build();
                                    })
                                    .toList();

                                // KPI ngược dùng bài nộp mới nhất; KPI thường cộng dồn (loại REJECTED)
                                List<KpiSubmission> nonRejected = assigneeValidSubs.stream()
                                    .filter(s -> s.getStatus() != SubmissionStatus.REJECTED)
                                    .toList();
                                if (Boolean.TRUE.equals(kpi.getIsReverseKpi())) {
                                    assigneeActual = KpiMetricsCalculator.latest(nonRejected);
                                    assigneeProgress = KpiMetricsCalculator.reversePercent(nonRejected, totalTarget);
                                } else {
                                    assigneeActual = KpiMetricsCalculator.sum(nonRejected);
                                    assigneeProgress = totalTarget > 0 ? (assigneeActual / totalTarget) * 100 : 0;
                                }
                            } else {
                                assigneeProgress = 0;
                            }

                            participantDtos.add(SubordinateDetailsResponses.KpiParticipantDto.builder()
                                .userId(assignee.getId())
                                .avatarUrl(assignee.getAvatarUrl())
                                .fullName(assignee.getFullName())
                                .employeeCode(assignee.getEmployeeCode() != null ? assignee.getEmployeeCode() : assignee.getEmail())
                                .roleName("Thành viên")
                                .orgUnitName(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : "")
                                .actualValue(assigneeActual)
                                .progress(assigneeProgress)
                                .performance(assigneeProgress)
                                .submissions(assigneeSubs)
                                .build());
                        }
                    }

                    OrgUnit firstUnit = obj.getOrgUnits().isEmpty() ? null : obj.getOrgUnits().get(0);
                    String unitName = firstUnit != null ? firstUnit.getName() : "";
                    String unitCode = firstUnit != null ? firstUnit.getCode() : "";
                    if (kpi.getAssignees() != null && !kpi.getAssignees().isEmpty()) {
                        User firstAssignee = kpi.getAssignees().get(0);
                        unitName = firstAssignee.getFullName();
                        unitCode = firstAssignee.getEmployeeCode() != null ? firstAssignee.getEmployeeCode() : firstAssignee.getEmail();
                    }

                    kpiDtos.add(KpiDetailedDto.builder()
                        .id(kpi.getId())
                        .name(kpi.getName())
                        .status(kpiStatus)
                        .progress(isBonus ? null : completion)
                        .performance(finalPerformance)
                        .targetValue(totalTarget)
                        .unit(kpi.getUnit())
                        .unitName(unitName)
                        .unitCode(unitCode)
                        .startDate(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getStartDate() : null)
                        .endDate(kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getEndDate() : null)
                        .participants(participantDtos)
                        .build());
                }

                if (sumWeight > 0) {
                    double krCompletion = sumWeightedCompletion / sumWeight;
                    double krPerformance = sumWeightedPerformance / sumWeight;

                    // Đơn vị được giao lấy từ chính KR (1 KR có thể nhiều đơn vị)
                    List<SubordinateDetailsResponses.KrUnitDto> krUnits = kr.getUnitWeights() == null ? java.util.List.of()
                        : kr.getUnitWeights().stream()
                            .filter(uw -> uw.getOrgUnit() != null)
                            .map(uw -> SubordinateDetailsResponses.KrUnitDto.builder()
                                .orgUnitId(uw.getOrgUnit().getId())
                                .orgUnitName(uw.getOrgUnit().getName())
                                .orgUnitCode(uw.getOrgUnit().getCode())
                                .weightPercentage(uw.getWeightPercentage())
                                .build())
                            .toList();

                    String krUnitName = krUnits.isEmpty()
                        ? (obj.getOrgUnits().isEmpty() ? null : obj.getOrgUnits().get(0).getName())
                        : krUnits.get(0).getOrgUnitName();
                    String krUnitCode = krUnits.isEmpty()
                        ? (obj.getOrgUnits().isEmpty() ? null : obj.getOrgUnits().get(0).getCode())
                        : krUnits.get(0).getOrgUnitCode();

                    krDtos.add(KeyResultDetailedDto.builder()
                        .id(kr.getId())
                        .name(kr.getName())
                        .code(kr.getCode())
                        .progress(krCompletion)
                        .performance(krPerformance)
                        .unitName(krUnitName)
                        .unitCode(krUnitCode)
                        .assignedUnits(krUnits)
                        .startDate(obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
                        .endDate(obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
                        .kpis(kpiDtos)
                        .build());

                    totalObjCompletion += krCompletion;
                    totalObjPerformance += krPerformance;
                    activeKrCount++;
                    if (krCompletion >= 100) {
                        completedKrs++;
                    }
                }
            }
        }

        double objProgress = activeKrCount > 0 ? totalObjCompletion / activeKrCount : 0.0;
        double objPerformance = activeKrCount > 0 ? totalObjPerformance / activeKrCount : 0.0;

        return ObjectiveDetailedDto.builder()
            .id(obj.getId())
            .name(obj.getName())
            .code(obj.getCode())
            .unitId(obj.getOrgUnits().isEmpty() ? null : obj.getOrgUnits().get(0).getId())
            .unitName(obj.getOrgUnits().isEmpty() ? "" : obj.getOrgUnits().get(0).getName())
            .unitCode(obj.getOrgUnits().isEmpty() ? "" : obj.getOrgUnits().get(0).getCode())
            .startDate(obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
            .endDate(obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
            .progress(objProgress)
            .performance(objPerformance)
            .completedKeyResults(completedKrs)
            .totalKeyResults(activeKrCount)
            .keyResults(krDtos)
            .build();
    }

    @Transactional(readOnly = true)
    public List<ObjectiveDetailedDto> getDetailedObjectives(Instant from, Instant to, Boolean onlyApproved) {
        List<Objective> objectives = getObjectivesInScope();
        return objectives.stream()
                .map(obj -> buildObjectiveDetailedDto(obj, from, to, onlyApproved))
                .filter(dto -> dto.getTotalKeyResults() > 0)
                .toList();
    }

    @Transactional(readOnly = true)
    public SubordinateDetailsResponses.PagedObjectiveDetailedResponse getDetailedObjectives(
            Instant from, Instant to, Boolean onlyApproved,
            String sortBy, String sortDir,
            UUID orgUnitId,
            int page, int size) {

        List<Objective> objectives = getObjectivesInScope();

        List<ObjectiveDetailedDto> allDtos = objectives.stream()
                .map(obj -> buildObjectiveDetailedDto(obj, from, to, onlyApproved))
                .filter(dto -> dto.getTotalKeyResults() > 0)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        // Filter by orgUnitId (includes descendants via path)
        if (orgUnitId != null) {
            // Collect the set of IDs that belong to the subtree rooted at orgUnitId
            List<UUID> subordinateIds = getSubordinateOrgUnitIds();
            // Find the subtree of orgUnitId within the already-authorized subordinate IDs
            List<OrgUnit> allSubordinateUnits = orgUnitRepository.findAllById(subordinateIds);
            OrgUnit targetUnit = allSubordinateUnits.stream()
                    .filter(u -> u.getId().equals(orgUnitId))
                    .findFirst().orElse(null);

            if (targetUnit != null) {
                String pathPrefix = targetUnit.getPath();
                Set<UUID> subtreeIds = allSubordinateUnits.stream()
                        .filter(u -> u.getPath() != null && u.getPath().startsWith(pathPrefix))
                        .map(OrgUnit::getId)
                        .collect(java.util.stream.Collectors.toSet());
                allDtos = allDtos.stream()
                        .filter(dto -> dto.getUnitId() != null && subtreeIds.contains(dto.getUnitId()))
                        .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
            } else {
                // orgUnitId not in scope — return empty
                allDtos = new ArrayList<>();
            }
        }

        // Sort
        if (sortBy != null) {
            boolean descending = !"asc".equalsIgnoreCase(sortDir);
            allDtos.sort((a, b) -> {
                double va, vb;
                if ("performance".equalsIgnoreCase(sortBy)) {
                    va = a.getPerformance() != null ? a.getPerformance() : 0.0;
                    vb = b.getPerformance() != null ? b.getPerformance() : 0.0;
                } else {
                    va = a.getProgress() != null ? a.getProgress() : 0.0;
                    vb = b.getProgress() != null ? b.getProgress() : 0.0;
                }
                return descending ? Double.compare(vb, va) : Double.compare(va, vb);
            });
        }

        long totalElements = allDtos.size();
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 1;
        int fromIdx = Math.min(page * size, (int) totalElements);
        int toIdx = Math.min(fromIdx + size, (int) totalElements);
        List<ObjectiveDetailedDto> pageContent = allDtos.subList(fromIdx, toIdx);

        return SubordinateDetailsResponses.PagedObjectiveDetailedResponse.builder()
                .content(pageContent)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .first(page == 0)
                .last(page >= totalPages - 1)
                .build();
    }

    @Transactional(readOnly = true)
    public List<SubordinateDetailsResponses.OrgUnitFilterDto> getAvailableOrgUnitsForFilter() {
        List<UUID> subordinateIds = getSubordinateOrgUnitIds();
        if (subordinateIds.isEmpty()) return Collections.emptyList();

        List<OrgUnit> units = orgUnitRepository.findAllById(subordinateIds);
        Set<UUID> unitIdSet = units.stream().map(OrgUnit::getId).collect(java.util.stream.Collectors.toSet());

        // Root nodes: those whose parent is null or whose parent is NOT in our set
        List<OrgUnit> roots = units.stream()
                .filter(u -> u.getParent() == null || !unitIdSet.contains(u.getParent().getId()))
                .toList();

        // Build flat list via depth-first traversal
        List<SubordinateDetailsResponses.OrgUnitFilterDto> result = new ArrayList<>();
        Map<UUID, List<OrgUnit>> childrenMap = units.stream()
                .filter(u -> u.getParent() != null && unitIdSet.contains(u.getParent().getId()))
                .collect(java.util.stream.Collectors.groupingBy(u -> u.getParent().getId()));

        for (OrgUnit root : roots) {
            buildOrgUnitFilterTree(root, 0, childrenMap, result);
        }

        return result;
    }

    private void buildOrgUnitFilterTree(
            OrgUnit unit, int depth,
            Map<UUID, List<OrgUnit>> childrenMap,
            List<SubordinateDetailsResponses.OrgUnitFilterDto> result) {

        // Pre-order: add this node first, then recurse into children
        result.add(SubordinateDetailsResponses.OrgUnitFilterDto.builder()
                .id(unit.getId())
                .name(unit.getName())
                .code(unit.getCode())
                .depth(depth)
                .children(new ArrayList<>())
                .build());

        List<OrgUnit> children = childrenMap.getOrDefault(unit.getId(), Collections.emptyList());
        for (OrgUnit child : children) {
            buildOrgUnitFilterTree(child, depth + 1, childrenMap, result);
        }
    }

    public SubordinateDetailsResponses.TopEntitiesDashboardResponse getTopEntitiesDashboard(Instant from, Instant to, String sortFilter, Boolean onlyApproved) {
        List<SubordinateDetailsResponses.ObjectiveDetailedDto> detailedObjs = getDetailedObjectives(from, to, onlyApproved);

        boolean isBest = !"WORST".equalsIgnoreCase(sortFilter);

        List<SubordinateDetailsResponses.TopObjectiveDto> topObjectives = detailedObjs.stream()
                .sorted((o1, o2) -> {
                    double p1 = o1.getProgress() != null ? o1.getProgress() : 0.0;
                    double p2 = o2.getProgress() != null ? o2.getProgress() : 0.0;
                    return isBest ? Double.compare(p2, p1) : Double.compare(p1, p2);
                })
                .limit(5)
                .map(obj -> SubordinateDetailsResponses.TopObjectiveDto.builder()
                        .id(obj.getId())
                        .name(obj.getName())
                        .code(obj.getCode())
                        .completionRate(obj.getProgress() != null ? obj.getProgress() : 0.0)
                        .performanceRate(obj.getPerformance() != null ? obj.getPerformance() : 0.0)
                        .build())
                .toList();

        java.util.Map<String, List<SubordinateDetailsResponses.ObjectiveDetailedDto>> byUnit = detailedObjs.stream()
                .filter(o -> o.getUnitName() != null && !o.getUnitName().trim().isEmpty())
                .collect(java.util.stream.Collectors.groupingBy(SubordinateDetailsResponses.ObjectiveDetailedDto::getUnitName));

        List<SubordinateDetailsResponses.TopUnitDto> allUnits = byUnit.entrySet().stream()
                .map(entry -> {
                    String unitName = entry.getKey();
                    List<SubordinateDetailsResponses.ObjectiveDetailedDto> unitObjs = entry.getValue();
                    double avgProg = unitObjs.stream().mapToDouble(o -> o.getProgress() != null ? o.getProgress() : 0.0).average().orElse(0.0);
                    double avgPerf = unitObjs.stream().mapToDouble(o -> o.getPerformance() != null ? o.getPerformance() : 0.0).average().orElse(0.0);
                    return SubordinateDetailsResponses.TopUnitDto.builder()
                            .unitName(unitName)
                            .completionRate(avgProg)
                            .performanceRate(avgPerf)
                            .build();
                })
                .toList();

        List<SubordinateDetailsResponses.TopUnitDto> topUnits = allUnits.stream()
                .sorted((u1, u2) -> {
                    double p1 = u1.getCompletionRate() != null ? u1.getCompletionRate() : 0.0;
                    double p2 = u2.getCompletionRate() != null ? u2.getCompletionRate() : 0.0;
                    return isBest ? Double.compare(p2, p1) : Double.compare(p1, p2);
                })
                .limit(5)
                .toList();

        return SubordinateDetailsResponses.TopEntitiesDashboardResponse.builder()
                .topObjectives(topObjectives)
                .topUnits(topUnits)
                .build();
    }

    // -------------------------------------------------------------
    // SCOPED DASHBOARD LOGIC (OBJECTIVE & KEY RESULT)
    // -------------------------------------------------------------

    private double[] calculateKpiMetricsAndActive(KpiCriteria kpi, Instant objStart, Instant objEnd, Instant A, Instant B, Boolean onlyApproved) {
        // KPI cha (decomposition): tiến độ/hiệu suất = bình quân có trọng số chuẩn hoá của các con.
        double parentWeight = kpi.getWeight() != null && kpi.getWeight() > 0 ? kpi.getWeight() : 1.0;
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            double wSum = 0, compSum = 0, perfSum = 0;
            boolean anyActive = false;
            for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
                double w = child.getWeight() != null && child.getWeight() > 0 ? child.getWeight() : 0.0;
                if (w <= 0) continue;
                double[] cm = calculateKpiMetricsAndActive(child, objStart, objEnd, A, B, onlyApproved);
                if (cm[3] == 0) continue;
                wSum += w;
                compSum += cm[0] * w;
                perfSum += cm[1] * w;
                anyActive = true;
            }
            if (!anyActive || wSum == 0) return new double[]{0, 0, parentWeight, anyActive ? 1 : 0};
            return new double[]{compSum / wSum, perfSum / wSum, parentWeight, 1.0};
        }

        Instant kpiStart = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null ?
                           kpi.getKpiPeriod().getStartDate() : objStart;
        Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null ? 
                         kpi.getKpiPeriod().getEndDate() : objEnd;

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc = B != null && B.isBefore(kpiEnd) ? B : kpiEnd;

        if (startCalc.isAfter(endCalc)) return new double[]{0, 0, 0, 0}; // 0 = inactive

        double totalKpiTime = Math.max(1, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio = Math.min(1.0, validFilterTime / totalKpiTime);

        double targetValue = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValueFilter = targetValue * timeRatio;

        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> {
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        return s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        return s.getStatus() == SubmissionStatus.APPROVED ||
                               s.getStatus() == SubmissionStatus.PENDING ||
                               s.getStatus() == SubmissionStatus.REJECTED;
                    }
                })
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !submissionTime.isBefore(kpiStart) && (B == null || !submissionTime.isAfter(B));
                })
                .toList();

        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> {
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        return s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        return s.getStatus() == SubmissionStatus.APPROVED ||
                               s.getStatus() == SubmissionStatus.PENDING ||
                               s.getStatus() == SubmissionStatus.REJECTED;
                    }
                })
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !submissionTime.isBefore(A)) && (B == null || !submissionTime.isAfter(B));
                })
                .toList();

        boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double completion = reverse
                ? KpiMetricsCalculator.reversePercent(complSubs, targetValue)
                : (targetValue > 0 ? (KpiMetricsCalculator.sum(complSubs) / targetValue) * 100 : 0);
        double performance = reverse
                ? KpiMetricsCalculator.reversePercent(perfSubs, targetValue)
                : (expectedValueFilter > 0 ? (KpiMetricsCalculator.sum(perfSubs) / expectedValueFilter) * 100 : 0);
        double weight = kpi.getWeight() != null && kpi.getWeight() > 0 ? kpi.getWeight() : 1.0;

        return new double[]{completion, performance, weight, 1.0};
    }

    private double[] calculateKrMetrics(KeyResult kr, Instant objStart, Instant objEnd, Instant A, Instant B, Boolean onlyApproved) {
        if (kr.getKpis() == null || kr.getKpis().isEmpty()) return new double[]{0.0, 0.0};
        double sumComp = 0, sumPerf = 0, sumW = 0;
        for (KpiCriteria kpi : kr.getKpis()) {
            // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
            if (kpi.getParent() != null) continue;
            // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
            double[] res = calculateKpiMetricsAndActive(kpi, objStart, objEnd, A, B, onlyApproved);
            if (res[3] > 0) {
                sumComp += (res[0] * res[2]);
                sumPerf += (res[1] * res[2]);
                sumW += res[2];
            }
        }
        return sumW > 0 ? new double[]{sumComp / sumW, sumPerf / sumW} : new double[]{0.0, 0.0};
    }

    // 1. Objective Scoped Metrics

    @Transactional(readOnly = true)
    public ScopedDashboardResponse.ScopedMetrics getObjectiveScopedMetrics(UUID objectiveId, Instant from, Instant to, Boolean onlyApproved) {
        Objective obj = objectiveRepository.findById(objectiveId)
                .orElseThrow(() -> new RuntimeException("Objective not found"));
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this objective");
        }

        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        double[] overallMetrics = calculateObjectiveMetrics(obj, from, to, onlyApproved);
        int completedCount = 0;
        int totalCount = obj.getKeyResults() != null ? obj.getKeyResults().size() : 0;
        int atRiskCount = 0;

        if (obj.getKeyResults() != null) {
            for (KeyResult kr : obj.getKeyResults()) {
                double[] krMetrics = calculateKrMetrics(kr, objStart, objEnd, from, to, onlyApproved);
                if (krMetrics[0] >= 100) completedCount++;
                
                boolean closeDeadline = false;
                if (obj.getEndDate() != null) {
                    long daysLeft = (obj.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() - Instant.now().toEpochMilli()) / (1000 * 60 * 60 * 24);
                    if (daysLeft >= 0 && daysLeft <= 7) closeDeadline = true;
                }
                if (krMetrics[0] < 50 && closeDeadline) atRiskCount++;
            }
        }

        return ScopedDashboardResponse.ScopedMetrics.builder()
                .completionRate(overallMetrics[0])
                .performanceRate(overallMetrics[1])
                .completedCount(completedCount)
                .totalCount(totalCount)
                .atRiskCount(atRiskCount)
                .build();
    }

    // 2. Objective Combo Chart
    @Transactional(readOnly = true)
    public SubordinateStatsResponses.ComboChartResponse getObjectiveScopedComboChart(UUID objectiveId, Instant from, Instant to, Boolean onlyApproved) {
        Objective obj = objectiveRepository.findById(objectiveId)
                .orElseThrow(() -> new RuntimeException("Objective not found"));
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this objective");
        }

        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, java.time.temporal.ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        
        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<SubordinateStatsResponses.ComboChartResponse.ChartPoint> points = new ArrayList<>();
        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        for (IntervalPoint ip : intervalPoints) {
            Instant pStart = ip.start;
            Instant pEnd = ip.end;
            String label = ip.label;

            int oldItems = 0;
            int newItems = 0;
            double totalComp = 0;
            double totalPerf = 0;
            int actItems = 0;

            if (obj.getKeyResults() != null) {
                for (KeyResult kr : obj.getKeyResults()) {
                    if (kr.getCreatedAt() == null) continue;
                    
                    boolean isActive = true;
                    if (!kr.getCreatedAt().isBefore(pEnd)) isActive = false;
                    if (kr.getDeletedAt() != null && kr.getDeletedAt().isBefore(pEnd)) isActive = false;
                    
                    if (isActive) {
                        if (kr.getCreatedAt().isBefore(pStart)) {
                            oldItems++;
                        } else {
                            newItems++;
                        }
                        
                        double[] metrics = calculateKrMetrics(kr, objStart, objEnd, effectiveFrom, pEnd, onlyApproved);
                        totalComp += metrics[0];
                        totalPerf += metrics[1];
                        actItems++;
                    }
                }
            }

            double avgComp = actItems > 0 ? totalComp / actItems : 0;
            double avgPerf = actItems > 0 ? totalPerf / actItems : 0;

            points.add(SubordinateStatsResponses.ComboChartResponse.ChartPoint.builder()
                    .label(label)
                    .oldItems(oldItems)
                    .newItems(newItems)
                    .completionTrend(Math.round(avgComp * 100.0) / 100.0)
                    .performanceTrend(Math.round(avgPerf * 100.0) / 100.0)
                    .build());
        }

        return new SubordinateStatsResponses.ComboChartResponse(points);
    }

    // 3. Objective Top Entities
    @Transactional(readOnly = true)
    public ScopedDashboardResponse.TopScopedEntitiesResponse getObjectiveScopedTopEntities(UUID objectiveId, Instant from, Instant to, Boolean onlyApproved) {
        Objective obj = objectiveRepository.findById(objectiveId)
                .orElseThrow(() -> new RuntimeException("Objective not found"));
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this objective");
        }

        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        List<ScopedDashboardResponse.TopItem> topItems = new ArrayList<>();
        Map<OrgUnit, double[]> unitAccumulators = new HashMap<>();

        if (obj.getKeyResults() != null) {
            for (KeyResult kr : obj.getKeyResults()) {
                double[] krMetrics = calculateKrMetrics(kr, objStart, objEnd, from, to, onlyApproved);
                
                topItems.add(ScopedDashboardResponse.TopItem.builder()
                        .id(kr.getId().toString())
                        .name(kr.getName())
                        .code(kr.getCode())
                        .completionRate(krMetrics[0])
                        .performanceRate(krMetrics[1])
                        .build());
                        
                if (kr.getKpis() != null) {
                    for (KpiCriteria kpi : kr.getKpis()) {
                        // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                        if (kpi.getParent() != null) continue;
                        // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
                        if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                        double[] kpiMetrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, from, to, onlyApproved);
                        if (kpiMetrics[3] > 0) {
                            unitAccumulators.computeIfAbsent(kpi.getOrgUnit(), k -> new double[]{0,0,0});
                            double[] acc = unitAccumulators.get(kpi.getOrgUnit());
                            acc[0] += kpiMetrics[0];
                            acc[1] += kpiMetrics[1];
                            acc[2]++;
                        }
                    }
                }
            }
        }
        
        topItems.sort((a, b) -> Double.compare(b.getPerformanceRate(), a.getPerformanceRate()));
        if (topItems.size() > 5) topItems = topItems.subList(0, 5);

        List<ScopedDashboardResponse.TopUnit> topUnits = unitAccumulators.entrySet().stream().map(e -> {
            double count = e.getValue()[2];
            return ScopedDashboardResponse.TopUnit.builder()
                    .unitId(e.getKey().getId().toString())
                    .unitName(e.getKey().getName())
                    .unitCode(e.getKey().getCode())
                    .completionRate(count > 0 ? e.getValue()[0] / count : 0)
                    .performanceRate(count > 0 ? e.getValue()[1] / count : 0)
                    .build();
        }).sorted((a, b) -> Double.compare(b.getPerformanceRate(), a.getPerformanceRate())).limit(5).toList();

        return ScopedDashboardResponse.TopScopedEntitiesResponse.builder()
                .topItems(topItems)
                .topUnits(topUnits)
                .build();
    }

    // 4. KeyResult Scoped Metrics

    @Transactional(readOnly = true)
    public ScopedDashboardResponse.ScopedMetrics getKeyResultScopedMetrics(UUID krId, Instant from, Instant to, Boolean onlyApproved) {
        KeyResult kr = keyResultRepository.findById(krId)
                .orElseThrow(() -> new RuntimeException("Key Result not found"));
        Objective obj = kr.getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this Key Result");
        }

        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        double[] krMetrics = calculateKrMetrics(kr, objStart, objEnd, from, to, onlyApproved);
        int completedCount = 0;
        int totalCount = kr.getKpis() != null ? kr.getKpis().size() : 0;
        int atRiskCount = 0;

        if (kr.getKpis() != null) {
            for (KpiCriteria kpi : kr.getKpis()) {
                // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                if (kpi.getParent() != null) continue;
                // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                double[] kpiMetrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, from, to, onlyApproved);
                if (kpiMetrics[3] > 0) {
                    if (kpiMetrics[0] >= 100) completedCount++;
                    
                    boolean closeDeadline = false;
                    Instant kpiEnd = kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null ? kpi.getKpiPeriod().getEndDate() : objEnd;
                    long daysLeft = (kpiEnd.toEpochMilli() - Instant.now().toEpochMilli()) / (1000 * 60 * 60 * 24);
                    if (daysLeft >= 0 && daysLeft <= 7) closeDeadline = true;
                    if (kpiMetrics[0] < 50 && closeDeadline) atRiskCount++;
                }
            }
        }

        return ScopedDashboardResponse.ScopedMetrics.builder()
                .completionRate(krMetrics[0])
                .performanceRate(krMetrics[1])
                .completedCount(completedCount)
                .totalCount(totalCount)
                .atRiskCount(atRiskCount)
                .build();
    }

    // 5. KeyResult Combo Chart
    @Transactional(readOnly = true)
    public SubordinateStatsResponses.ComboChartResponse getKeyResultScopedComboChart(UUID krId, Instant from, Instant to, Boolean onlyApproved) {
        KeyResult kr = keyResultRepository.findById(krId)
                .orElseThrow(() -> new RuntimeException("Key Result not found"));
        Objective obj = kr.getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this Key Result");
        }

        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, java.time.temporal.ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        
        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<SubordinateStatsResponses.ComboChartResponse.ChartPoint> points = new ArrayList<>();
        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        for (IntervalPoint ip : intervalPoints) {
            Instant pStart = ip.start;
            Instant pEnd = ip.end;
            String label = ip.label;

            int oldItems = 0;
            int newItems = 0;
            double totalComp = 0;
            double totalPerf = 0;
            int actItems = 0;

            if (kr.getKpis() != null) {
                for (KpiCriteria kpi : kr.getKpis()) {
                    if (kpi.getCreatedAt() == null) continue;
                    // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                    if (kpi.getParent() != null) continue;
                    // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
                    if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;

                    boolean isActive = true;
                    Instant kpiRef = (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getStartDate() != null)
                            ? kpi.getKpiPeriod().getStartDate()
                            : kpi.getCreatedAt();
                    if (kpiRef == null || !kpiRef.isBefore(pEnd)) isActive = false;
                    if (kpi.getDeletedAt() != null && kpi.getDeletedAt().isBefore(pEnd)) isActive = false;

                    if (isActive) {
                        if (kpiRef.isBefore(pStart)) {
                            oldItems++;
                        } else {
                            newItems++;
                        }
                        
                        double[] metrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, effectiveFrom, pEnd, onlyApproved);
                        totalComp += metrics[0];
                        totalPerf += metrics[1];
                        actItems++;
                    }
                }
            }

            double avgComp = actItems > 0 ? totalComp / actItems : 0;
            double avgPerf = actItems > 0 ? totalPerf / actItems : 0;

            points.add(SubordinateStatsResponses.ComboChartResponse.ChartPoint.builder()
                    .label(label)
                    .oldItems(oldItems)
                    .newItems(newItems)
                    .completionTrend(Math.round(avgComp * 100.0) / 100.0)
                    .performanceTrend(Math.round(avgPerf * 100.0) / 100.0)
                    .build());
        }

        return new SubordinateStatsResponses.ComboChartResponse(points);
    }

    // 6. KeyResult Top Entities
    @Transactional(readOnly = true)
    public ScopedDashboardResponse.TopScopedEntitiesResponse getKeyResultScopedTopEntities(UUID krId, Instant from, Instant to, Boolean onlyApproved) {
        KeyResult kr = keyResultRepository.findById(krId)
                .orElseThrow(() -> new RuntimeException("Key Result not found"));
        Objective obj = kr.getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this Key Result");
        }

        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        List<ScopedDashboardResponse.TopItem> topItems = new ArrayList<>();
        Map<OrgUnit, double[]> unitAccumulators = new HashMap<>();

        if (kr.getKpis() != null) {
            for (KpiCriteria kpi : kr.getKpis()) {
                // KPI thác nước (có parent) không tính riêng; kết quả đã tổng hợp lên KPI cha.
                if (kpi.getParent() != null) continue;
                // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính.
                if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
                double[] kpiMetrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, from, to, onlyApproved);
                if (kpiMetrics[3] > 0) {
                    topItems.add(ScopedDashboardResponse.TopItem.builder()
                            .id(kpi.getId().toString())
                            .name(kpi.getName())
                            .code("") // KPIs don't have code in entity
                            .completionRate(kpiMetrics[0])
                            .performanceRate(kpiMetrics[1])
                            .build());

                    unitAccumulators.computeIfAbsent(kpi.getOrgUnit(), k -> new double[]{0,0,0});
                    double[] acc = unitAccumulators.get(kpi.getOrgUnit());
                    acc[0] += kpiMetrics[0];
                    acc[1] += kpiMetrics[1];
                    acc[2]++;
                }
            }
        }

        topItems.sort((a, b) -> Double.compare(b.getPerformanceRate(), a.getPerformanceRate()));
        if (topItems.size() > 5) topItems = topItems.subList(0, 5);

        List<ScopedDashboardResponse.TopUnit> topUnits = unitAccumulators.entrySet().stream().map(e -> {
            double count = e.getValue()[2];
            return ScopedDashboardResponse.TopUnit.builder()
                    .unitId(e.getKey().getId().toString())
                    .unitName(e.getKey().getName())
                    .unitCode(e.getKey().getCode())
                    .completionRate(count > 0 ? e.getValue()[0] / count : 0)
                    .performanceRate(count > 0 ? e.getValue()[1] / count : 0)
                    .build();
        }).sorted((a, b) -> Double.compare(b.getPerformanceRate(), a.getPerformanceRate())).limit(5).toList();

        return ScopedDashboardResponse.TopScopedEntitiesResponse.builder()
                .topItems(topItems)
                .topUnits(topUnits)
                .build();
    }

    // 7. KPI Scoped Metrics
    @Transactional(readOnly = true)
    public ScopedDashboardResponse.ScopedMetrics getKpiScopedMetrics(UUID kpiId, Instant from, Instant to, Boolean onlyApproved) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI not found"));
        Objective obj = kpi.getKeyResult().getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this KPI");
        }

        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        double[] kpiMetrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, from, to, onlyApproved);

        // Count completed submissions
        long completedCount = kpi.getSubmissions().stream()
                .filter(s -> {
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        return s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        return s.getStatus() == SubmissionStatus.APPROVED ||
                               s.getStatus() == SubmissionStatus.PENDING ||
                               s.getStatus() == SubmissionStatus.REJECTED;
                    }
                })
                .count();

        int totalCount = kpi.getExpectedSubmissions() != null ? kpi.getExpectedSubmissions() : 0;

        // Calculate near-deadline submission count (days left in period <= 7)
        int atRiskCount = 0;
        if (kpi.getKpiPeriod() != null && kpi.getKpiPeriod().getEndDate() != null) {
            long daysLeft = (kpi.getKpiPeriod().getEndDate().toEpochMilli() - Instant.now().toEpochMilli()) / (1000 * 60 * 60 * 24);
            if (daysLeft >= 0 && daysLeft <= 7) {
                atRiskCount = 1;
            }
        }

        return ScopedDashboardResponse.ScopedMetrics.builder()
                .completionRate(kpiMetrics[0])
                .performanceRate(kpiMetrics[1])
                .completedCount((int) completedCount)
                .totalCount(totalCount)
                .atRiskCount(atRiskCount)
                .build();
    }

    // 8. KPI Scoped Combo Chart
    @Transactional(readOnly = true)
    public SubordinateStatsResponses.ComboChartResponse getKpiScopedComboChart(UUID kpiId, Instant from, Instant to, Boolean onlyApproved) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI not found"));
        Objective obj = kpi.getKeyResult().getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this KPI");
        }

        Instant effectiveFrom = from != null ? from : Instant.now().minus(180, java.time.temporal.ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now();
        
        List<IntervalPoint> intervalPoints = generateIntervalPoints(effectiveFrom, effectiveTo);
        List<SubordinateStatsResponses.ComboChartResponse.ChartPoint> points = new ArrayList<>();
        Instant objStart = obj.getStartDate() != null ? obj.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.EPOCH;
        Instant objEnd = obj.getEndDate() != null ? obj.getEndDate().atStartOfDay().plusDays(1).toInstant(ZoneOffset.UTC) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);

        for (IntervalPoint ip : intervalPoints) {
            Instant pStart = ip.start;
            Instant pEnd = ip.end;
            String label = ip.label;

            int oldItems = 0;
            int newItems = 0;

            if (kpi.getSubmissions() != null) {
                for (KpiSubmission s : kpi.getSubmissions()) {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    if (submissionTime == null) continue;
                    boolean matchesFilter = false;
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        matchesFilter = s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        matchesFilter = s.getStatus() == SubmissionStatus.APPROVED ||
                                        s.getStatus() == SubmissionStatus.PENDING ||
                                        s.getStatus() == SubmissionStatus.REJECTED;
                    }
                    if (matchesFilter) {
                        if (submissionTime.isBefore(pStart)) {
                            oldItems++;
                        } else if (submissionTime.isBefore(pEnd)) {
                            newItems++;
                        }
                    }
                }
            }

            double[] metrics = calculateKpiMetricsAndActive(kpi, objStart, objEnd, effectiveFrom, pEnd, onlyApproved);

            points.add(SubordinateStatsResponses.ComboChartResponse.ChartPoint.builder()
                    .label(label)
                    .oldItems(oldItems)
                    .newItems(newItems)
                    .completionTrend(Math.round(metrics[0] * 100.0) / 100.0)
                    .performanceTrend(Math.round(metrics[1] * 100.0) / 100.0)
                    .build());
        }

        return new SubordinateStatsResponses.ComboChartResponse(points);
    }

    // 9. KPI Scoped Top Entities
    @Transactional(readOnly = true)
    public ScopedDashboardResponse.TopScopedEntitiesResponse getKpiScopedTopEntities(UUID kpiId, Instant from, Instant to, Boolean onlyApproved) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI not found"));
        Objective obj = kpi.getKeyResult().getObjective();
        
        List<UUID> allowedOrgUnits = getSubordinateOrgUnitIds();
        if (obj.getOrgUnits().stream().noneMatch(u -> allowedOrgUnits.contains(u.getId()))) {
            throw new RuntimeException("Access denied to this KPI");
        }

        // Map submissions to TopItem
        List<ScopedDashboardResponse.TopItem> topItems = kpi.getSubmissions().stream()
                .filter(s -> {
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        return s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        return s.getStatus() == SubmissionStatus.APPROVED ||
                               s.getStatus() == SubmissionStatus.PENDING ||
                               s.getStatus() == SubmissionStatus.REJECTED;
                    }
                })
                .map(s -> {
                    double target = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
                    double val = s.getActualValue() != null ? s.getActualValue() : 0.0;
                    double rate = KpiMetricsCalculator.percent(val, target, Boolean.TRUE.equals(kpi.getIsReverseKpi()));
                    String note = s.getNote() != null && !s.getNote().trim().isEmpty() ? s.getNote() : "Bài nộp #" + s.getId().toString().substring(0,4);
                    return ScopedDashboardResponse.TopItem.builder()
                            .id(s.getId().toString())
                            .name(note)
                            .code(s.getStatus().name())
                            .completionRate(rate)
                            .performanceRate(rate)
                            .build();
                })
                .sorted((a, b) -> Double.compare(b.getCompletionRate(), a.getCompletionRate()))
                .limit(5)
                .toList();

        // Group submissions by User
        Map<User, List<KpiSubmission>> byUser = kpi.getSubmissions().stream()
                .filter(s -> {
                    if (Boolean.TRUE.equals(onlyApproved)) {
                        return s.getStatus() == SubmissionStatus.APPROVED;
                    } else {
                        return s.getStatus() == SubmissionStatus.APPROVED ||
                               s.getStatus() == SubmissionStatus.PENDING ||
                               s.getStatus() == SubmissionStatus.REJECTED;
                    }
                })
                .collect(java.util.stream.Collectors.groupingBy(KpiSubmission::getSubmittedBy));

        List<ScopedDashboardResponse.TopUnit> topUnits = byUser.entrySet().stream()
                .map(entry -> {
                    User user = entry.getKey();
                    List<KpiSubmission> userSubs = entry.getValue();
                    double target = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
                    boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
                    double totalVal = reverse ? KpiMetricsCalculator.latest(userSubs) : KpiMetricsCalculator.sum(userSubs);
                    double completion = reverse ? KpiMetricsCalculator.reversePercent(userSubs, target) : (totalVal / target) * 100;
                    return ScopedDashboardResponse.TopUnit.builder()
                            .unitId(user.getId().toString())
                            .unitName(user.getFullName())
                            .unitCode(user.getEmployeeCode() != null ? user.getEmployeeCode() : user.getEmail())
                            .completionRate(completion)
                            .performanceRate(completion)
                            .build();
                })
                .sorted((a, b) -> Double.compare(b.getCompletionRate(), a.getCompletionRate()))
                .limit(5)
                .toList();

        return ScopedDashboardResponse.TopScopedEntitiesResponse.builder()
                .topItems(topItems)
                .topUnits(topUnits)
                .build();
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

        IntervalPoint(Instant start, Instant end, String label) {
            this.start = start;
            this.end = end;
            this.label = label;
        }
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
