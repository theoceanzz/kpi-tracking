package com.kpitracking.service;

import com.kpitracking.dto.response.stats.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @Transactional(readOnly = true)
    public OverviewStatsResponse getOverviewStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) {
            return OverviewStatsResponse.builder().build();
        }

        return OverviewStatsResponse.builder()
                .totalUsers(userRoleOrgUnitRepository.countUsersByOrganizationId(orgId))
                .totalOrgUnits(orgUnitRepository.countByOrgHierarchyLevel_Organization_Id(orgId))
                .totalKpiCriteria(kpiCriteriaRepository.countByOrganizationId(orgId))
                .approvedKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.REJECTED))
                .draftKpi(kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.DRAFT))
                .totalSubmissions(submissionRepository.countByOrganizationId(orgId))
                .pendingSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.PENDING))
                .approvedSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.APPROVED))
                .rejectedSubmissions(submissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.REJECTED))
                .totalEvaluations(evaluationRepository.countByOrganizationId(orgId))
                .build();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitKpiStatsResponse> getOrgUnitKpiStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) return Collections.emptyList();

        List<OrgUnit> orgUnits = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);

        return orgUnits.stream().map(unit -> OrgUnitKpiStatsResponse.builder()
                .orgUnitId(unit.getId())
                .orgUnitName(unit.getName())
                .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitId(unit.getId()))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.APPROVED))
                .pendingKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.PENDING_APPROVAL))
                .rejectedKpi(kpiCriteriaRepository.countByOrgUnitIdAndStatus(unit.getId(), KpiStatus.REJECTED))
                .totalSubmissions(submissionRepository.countByOrgUnitId(unit.getId()))
                .approvedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdAndStatus(unit.getId(), SubmissionStatus.REJECTED))
                .build()
        ).toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeKpiStatsResponse> getEmployeeKpiStats() {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) return Collections.emptyList();

        List<User> users = userRoleOrgUnitRepository.findUsersByOrganizationId(orgId);
        List<EmployeeKpiStatsResponse> result = new ArrayList<>();

        for (User u : users) {
             List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
             String roleName = roles.isEmpty() ? "N/A" : roles.get(0).getRole().getName();
             String orgUnitName = roles.isEmpty() ? null : roles.get(0).getOrgUnit().getName();

             long assignedKpi = kpiCriteriaRepository.countByAssigneeAndStatus(u.getId(), KpiStatus.APPROVED);
             long totalSub = submissionRepository.countBySubmittedById(u.getId());
             long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
             long pendingSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING);
             long rejectedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED);
             Double avgScore = evaluationRepository.avgScoreByUserId(u.getId());

             result.add(EmployeeKpiStatsResponse.builder()
                     .userId(u.getId())
                     .fullName(u.getFullName())
                     .email(u.getEmail())
                     .role(roleName)
                     .orgUnitName(orgUnitName)
                     .assignedKpi(assignedKpi)
                     .totalSubmissions(totalSub)
                     .approvedSubmissions(approvedSub)
                     .pendingSubmissions(pendingSub)
                     .rejectedSubmissions(rejectedSub)
                     .averageScore(avgScore)
                     .build());
        }

        result.sort((a, b) -> Long.compare(b.getApprovedSubmissions(), a.getApprovedSubmissions()));
        return result;
    }

    @Transactional(readOnly = true)
    public MyKpiProgressResponse getMyKpiProgress() {
        User currentUser = getCurrentUser();
        UUID userId = currentUser.getId();

        long totalAssigned = kpiCriteriaRepository.countByAssigneeAndStatus(userId, KpiStatus.APPROVED);
        long totalSubmissions = submissionRepository.countBySubmittedById(userId);
        long approved = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED);
        long pending = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING);
        long rejected = submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED);
        Double avgScore = evaluationRepository.avgScoreByUserId(userId);

        return MyKpiProgressResponse.builder()
                .totalAssignedKpi(totalAssigned)
                .totalSubmissions(totalSubmissions)
                .approvedSubmissions(approved)
                .pendingSubmissions(pending)
                .rejectedSubmissions(rejected)
                .averageScore(avgScore)
                .build();
    }

    @Transactional(readOnly = true)
    public AnalyticsMyStatsResponse getMyAnalytics(Instant from, Instant to) {
        User currentUser = getCurrentUser();
        UUID userId = currentUser.getId();

        List<KpiCriteria> kpis;
        if (from != null && to != null) {
            kpis = kpiCriteriaRepository.findApprovedByAssigneeIdAndPeriod(userId, from, to);
        } else {
            kpis = kpiCriteriaRepository.findApprovedByAssigneeId(userId);
        }

        List<AnalyticsMyStatsResponse.KpiProgressItem> kpiItems = kpis.stream().map(k -> {
            Double actualValue = null;
            var subs = submissionRepository.findBySubmittedByIdOrderByCreatedAtDesc(userId);
            for (var s : subs) {
                if (s.getKpiCriteria().getId().equals(k.getId()) && s.getStatus() == SubmissionStatus.APPROVED) {
                    actualValue = s.getActualValue();
                    break;
                }
            }

            double completionRate = 0;
            if (k.getTargetValue() != null && k.getTargetValue() > 0 && actualValue != null) {
                completionRate = Math.min(100.0, (actualValue / k.getTargetValue()) * 100);
            }

            return AnalyticsMyStatsResponse.KpiProgressItem.builder()
                    .kpiId(k.getId())
                    .kpiName(k.getName())
                    .unit(k.getUnit())
                    .targetValue(k.getTargetValue())
                    .actualValue(actualValue)
                    .completionRate(completionRate)
                    .status(k.getStatus().name())
                    .orgUnitName(k.getOrgUnit().getName())
                    .build();
        }).toList();

        List<Evaluation> evaluations;
        if (from != null && to != null) {
            evaluations = evaluationRepository.findByUserIdAndPeriod(userId, from, to);
        } else {
            evaluations = evaluationRepository.findAllByUserIdOrdered(userId);
        }

        List<AnalyticsMyStatsResponse.EvaluationItem> evalItems = evaluations.stream().map(e ->
            AnalyticsMyStatsResponse.EvaluationItem.builder()
                    .id(e.getId())
                    .kpiName(e.getKpiCriteria().getName())
                    .score(e.getScore())
                    .comment(e.getComment())
                    .evaluatorName(e.getEvaluator().getFullName())
                    .createdAt(e.getCreatedAt())
                    .build()
        ).toList();

        return AnalyticsMyStatsResponse.builder()
                .totalAssignedKpi((long) kpis.size())
                .totalSubmissions(submissionRepository.countBySubmittedById(userId))
                .approvedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(userId, SubmissionStatus.REJECTED))
                .averageScore(evaluationRepository.avgScoreByUserId(userId))
                .kpiItems(kpiItems)
                .evaluationHistory(evalItems)
                .build();
    }

    @Transactional(readOnly = true)
    public AnalyticsDrillDownResponse getDrillDown(UUID orgUnitId) {
        User currentUser = getCurrentUser();
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        if (userRoles.isEmpty()) return AnalyticsDrillDownResponse.builder().build();

        OrgUnit userUnit = userRoles.get(0).getOrgUnit();
        OrgUnit currentOrgUnit = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        if (!currentOrgUnit.getPath().startsWith(userUnit.getPath())) currentOrgUnit = userUnit;

        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(currentOrgUnit.getId());
        List<AnalyticsDrillDownResponse.OrgUnitSummary> childSummaries = childUnits.stream().map(unit -> {
            List<UUID> subtreeIds = getSubtreeIds(unit);
            List<KpiCriteria> unitKpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
            double totalPerformance = 0;
            for (KpiCriteria kpi : unitKpis) {
                double actual = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
                double target = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
                totalPerformance += Math.min(100.0, (actual / target) * 100.0);
            }
            return AnalyticsDrillDownResponse.OrgUnitSummary.builder()
                    .orgUnitId(unit.getId())
                    .orgUnitName(unit.getName())
                    .levelName(unit.getOrgHierarchyLevel().getUnitTypeName())
                    .memberCount(userRoleOrgUnitRepository.findByOrgUnitId(unit.getId()).size())
                    .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedKpi(unitKpis.size())
                    .completionRate(!unitKpis.isEmpty() ? totalPerformance / unitKpis.size() : 0)
                    .totalSubmissions(submissionRepository.countByOrgUnitIdIn(subtreeIds))
                    .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds))
                    .hasChildren(!orgUnitRepository.findByParentId(unit.getId()).isEmpty())
                    .build();
        }).toList();

        List<AnalyticsDrillDownResponse.HeatmapPoint> heatmapData = new ArrayList<>();
        for (OrgUnit child : childUnits) {
            List<UUID> subtreeIds = getSubtreeIds(child);
            List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
            for (KpiCriteria kpi : kpis) {
                double actual = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
                double target = kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? kpi.getTargetValue() : 1.0;
                heatmapData.add(AnalyticsDrillDownResponse.HeatmapPoint.builder().x(child.getName()).y(kpi.getName()).value(Math.min(100.0, (actual / target) * 100.0)).build());
            }
        }

        List<UserRoleOrgUnit> members = userRoleOrgUnitRepository.findByOrgUnitId(currentOrgUnit.getId());
        List<AnalyticsDrillDownResponse.EmployeeSummary> employeeSummaries = members.stream().map(m -> {
            User u = m.getUser();
            return AnalyticsDrillDownResponse.EmployeeSummary.builder()
                    .userId(u.getId()).fullName(u.getFullName()).email(u.getEmail()).roleName(m.getRole().getName())
                    .assignedKpi(kpiCriteriaRepository.countByAssigneeId(u.getId()))
                    .totalSubmissions(submissionRepository.countBySubmittedById(u.getId()))
                    .approvedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED))
                    .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByUserId(u.getId())).build();
        }).toList();

        List<UUID> currentSubtree = getSubtreeIds(currentOrgUnit);
        return AnalyticsDrillDownResponse.builder()
                .orgUnitId(currentOrgUnit.getId()).orgUnitName(currentOrgUnit.getName()).levelName(currentOrgUnit.getOrgHierarchyLevel().getUnitTypeName())
                .totalKpi(kpiCriteriaRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedKpi(kpiCriteriaRepository.countByOrgUnitIdInAndStatus(currentSubtree, KpiStatus.APPROVED))
                .totalSubmissions(submissionRepository.countByOrgUnitIdIn(currentSubtree))
                .approvedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.APPROVED))
                .pendingSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.PENDING))
                .rejectedSubmissions(submissionRepository.countByOrgUnitIdInAndStatus(currentSubtree, SubmissionStatus.REJECTED))
                .avgScore(evaluationRepository.avgScoreByOrgUnitIdIn(currentSubtree))
                .memberCount(members.size()).childUnits(childSummaries).employees(employeeSummaries).heatmapData(heatmapData).build();
    }

    @Transactional(readOnly = true)
    public PageResponse<AnalyticsDetailRow> getDetailTable(UUID orgUnitId, String search, int page, int size) {
        User currentUser = getCurrentUser();
        UUID orgId = getCurrentUserOrganizationId(currentUser);
        if (orgId == null) return PageResponse.<AnalyticsDetailRow>builder().content(List.of()).build();

        List<User> initialUsers;
        if (orgUnitId != null) {
            OrgUnit unit = orgUnitRepository.findById(orgUnitId).orElse(null);
            if (unit == null) return PageResponse.<AnalyticsDetailRow>builder().content(List.of()).build();
            List<UUID> subtreeIds = getSubtreeIds(unit);
            Set<User> uniqueUsers = new LinkedHashSet<>();
            for (UUID suId : subtreeIds) userRoleOrgUnitRepository.findByOrgUnitId(suId).forEach(m -> uniqueUsers.add(m.getUser()));
            initialUsers = new ArrayList<>(uniqueUsers);
        } else {
            initialUsers = userRoleOrgUnitRepository.findUsersByOrganizationId(orgId);
        }

        List<User> users = initialUsers;
        if (search != null && !search.isBlank()) {
            String lowerSearch = search.toLowerCase();
            users = initialUsers.stream().filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase().contains(lowerSearch)) || (u.getEmail() != null && u.getEmail().toLowerCase().contains(lowerSearch))).toList();
        }

        List<AnalyticsDetailRow> allRows = new ArrayList<>();
        for (User u : users) {
            List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(u.getId());
            long assignedKpi = kpiCriteriaRepository.countByAssigneeId(u.getId());
            long approvedSub = submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.APPROVED);
            allRows.add(AnalyticsDetailRow.builder()
                    .userId(u.getId()).fullName(u.getFullName()).email(u.getEmail())
                    .orgUnitName(roles.isEmpty() ? null : roles.get(0).getOrgUnit().getName())
                    .roleName(roles.isEmpty() ? "N/A" : roles.get(0).getRole().getName())
                    .assignedKpi(assignedKpi).completedKpi(approvedSub)
                    .completionRate(assignedKpi > 0 ? Math.round((double) approvedSub / assignedKpi * 100.0) : 0)
                    .totalSubmissions(submissionRepository.countBySubmittedById(u.getId()))
                    .approvedSubmissions(approvedSub)
                    .pendingSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.PENDING))
                    .rejectedSubmissions(submissionRepository.countBySubmittedByIdAndStatus(u.getId(), SubmissionStatus.REJECTED))
                    .avgScore(evaluationRepository.avgScoreByUserId(u.getId()))
                    .lastSubmissionDate(submissionRepository.findLatestSubmissionDateByUserId(u.getId())).build());
        }

        allRows.sort((a, b) -> Double.compare(b.getCompletionRate(), a.getCompletionRate()));
        int totalElements = allRows.size();
        int fromIdx = Math.min(page * size, totalElements);
        int toIdx = Math.min(fromIdx + size, totalElements);
        return PageResponse.<AnalyticsDetailRow>builder().content(allRows.subList(fromIdx, toIdx)).page(page).size(size).totalElements(totalElements).totalPages((int) Math.ceil((double) totalElements / size)).last(page >= (int) Math.ceil((double) totalElements / size) - 1).build();
    }

    private List<UUID> getSubtreeIds(OrgUnit unit) {
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath());
        return subtree.isEmpty() ? List.of(unit.getId()) : subtree.stream().map(OrgUnit::getId).toList();
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryResponse getSummary(UUID orgUnitId, UUID rankingUnitId, String direction) {
        User currentUser = getCurrentUser();
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        if (userRoles.isEmpty()) return AnalyticsSummaryResponse.builder().build();

        OrgUnit userUnit = userRoles.get(0).getOrgUnit();
        OrgUnit targetUnit = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        if (!targetUnit.getPath().startsWith(userUnit.getPath())) targetUnit = userUnit;

        List<UUID> subtreeIds = getSubtreeIds(targetUnit);
        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(targetUnit.getId());

        // Overview logic
        List<KpiCriteria> allKpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(subtreeIds, KpiStatus.APPROVED);
        double totalPerf = 0;
        for (KpiCriteria kpi : allKpis) {
            double actual = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(kpi.getId(), subtreeIds, SubmissionStatus.APPROVED);
            double target = kpi.getTargetValue() != null && kpi.getTargetValue() > 0 ? kpi.getTargetValue() : 1.0;
            totalPerf += Math.min(100.0, (actual / target) * 100.0);
        }
        
        long pendingSubs = submissionRepository.countByOrgUnitIdInAndStatus(subtreeIds, SubmissionStatus.PENDING);
        List<UserRoleOrgUnit> allMembers = userRoleOrgUnitRepository.findAll().stream().filter(m -> subtreeIds.contains(m.getOrgUnit().getId())).toList();

        // Structure logic
        List<AnalyticsSummaryResponse.OrgDistribution> memberDist = childUnits.stream()
            .map(u -> new AnalyticsSummaryResponse.OrgDistribution(u.getName(), (long) getSubtreeIds(u).size()))
            .toList();

        List<AnalyticsSummaryResponse.RoleDistribution> roleDist = childUnits.stream().map(u -> {
            List<UUID> subtree = getSubtreeIds(u);
            List<UserRoleOrgUnit> members = userRoleOrgUnitRepository.findAll().stream()
                .filter(m -> subtree.contains(m.getOrgUnit().getId())).toList();
            long directors = members.stream().filter(m -> m.getRole().getName().contains("DIRECTOR")).count();
            long heads = members.stream().filter(m -> m.getRole().getName().contains("HEAD") || m.getRole().getName().contains("MANAGER")).count();
            return new AnalyticsSummaryResponse.RoleDistribution(u.getName(), directors, heads, members.size() - directors - heads);
        }).toList();

        // Data for initial load
        SummarySubData.UnitComparisonData comp = getUnitComparison(targetUnit.getId(), "MONTH");
        SummarySubData.RiskData risks = getRisks(targetUnit.getId(), "MONTH");
        SummarySubData.RankingData rankings = getRankings(targetUnit.getId(), rankingUnitId, "MONTH");

        return AnalyticsSummaryResponse.builder()
                .orgUnitId(targetUnit.getId()).orgUnitName(targetUnit.getName()).levelName(targetUnit.getOrgHierarchyLevel().getUnitTypeName())
                .kpiCompletionRate(allKpis.isEmpty() ? 0 : totalPerf / allKpis.size())
                .avgPerformanceScore(evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds) != null ? evaluationRepository.avgScoreByOrgUnitIdIn(subtreeIds) : 0)
                .overdueKpiRate(allKpis.isEmpty() ? 0 : (pendingSubs * 10.0 / allKpis.size()))
                .totalMembers((long) allMembers.size()).activeKpis((long) allKpis.size())
                .trendData(getTrend(targetUnit.getId(), "5_MONTHS"))
                .topPerformingUnits(comp.getTopPerformingUnits())
                .worstPerformingUnits(comp.getWorstPerformingUnits())
                .unitKpiData(comp.getUnitKpiData())
                .memberDistribution(memberDist)
                .roleDistribution(roleDist)
                .unitRisks(risks.getUnitRisks())
                .userRisks(risks.getUserRisks())
                .rankings(rankings.getRankings())
                .kpiRankings(rankings.getKpiRankings())
                .rankingOptions(rankings.getRankingOptions())
                .build();
    }

    @Transactional(readOnly = true)
    public List<AnalyticsSummaryResponse.TrendPoint> getTrend(UUID orgUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        List<AnalyticsSummaryResponse.TrendPoint> trends = new ArrayList<>();
        int count = 5;
        java.time.LocalDate now = java.time.LocalDate.now();
        for (int i = count - 1; i >= 0; i--) {
            java.time.LocalDate date = period.contains("DAYS") ? now.minusDays(i) : period.contains("WEEKS") ? now.minusWeeks(i) : now.minusMonths(i);
            String label = period.contains("DAYS") ? date.getDayOfMonth() + "/" + date.getMonthValue() : period.contains("WEEKS") ? "W" + date.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR) : "T" + date.getMonthValue();
            trends.add(new AnalyticsSummaryResponse.TrendPoint(label, 70 + Math.random() * 20, 65 + Math.random() * 25));
        }
        return trends;
    }

    @Transactional(readOnly = true)
    public SummarySubData.UnitComparisonData getUnitComparison(UUID orgUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        List<OrgUnit> childUnits = orgUnitRepository.findByParentId(targetUnit.getId());
        List<AnalyticsSummaryResponse.UnitComparison> unitComps = childUnits.stream().map(unit -> {
            List<UUID> unitSubtree = getSubtreeIds(unit);
            List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdInAndStatus(unitSubtree, KpiStatus.APPROVED);
            double perf = 0;
            for (KpiCriteria k : kpis) {
                double act = submissionRepository.sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(k.getId(), unitSubtree, SubmissionStatus.APPROVED);
                perf += Math.min(100.0, (act / (k.getTargetValue() != null && k.getTargetValue() > 0 ? k.getTargetValue() : 1.0)) * 100.0);
            }
            return new AnalyticsSummaryResponse.UnitComparison(unit.getName(), kpis.isEmpty() ? 0 : perf / kpis.size(), 100);
        }).sorted((a,b) -> Double.compare(b.getPerformance(), a.getPerformance())).toList();

        return new SummarySubData.UnitComparisonData(unitComps.stream().limit(3).toList(), unitComps.stream().sorted(Comparator.comparingDouble(AnalyticsSummaryResponse.UnitComparison::getPerformance)).limit(3).toList(), childUnits.stream().map(u -> {
            List<UUID> s = getSubtreeIds(u);
            return new AnalyticsSummaryResponse.UnitKpiComparison(u.getName(), kpiCriteriaRepository.countByOrgUnitIdInAndStatus(s, KpiStatus.APPROVED), submissionRepository.countByOrgUnitIdInAndStatus(s, SubmissionStatus.APPROVED));
        }).toList());
    }

    @Transactional(readOnly = true)
    public SummarySubData.RiskData getRisks(UUID orgUnitId, String period) {
        SummarySubData.UnitComparisonData comp = getUnitComparison(orgUnitId, period);
        return new SummarySubData.RiskData(comp.getTopPerformingUnits().stream().filter(u -> u.getPerformance() < 70).map(u -> new AnalyticsSummaryResponse.RiskInfo(u.getUnitName(), "UNIT", u.getPerformance(), 0, "HIGH")).toList(), List.of(new AnalyticsSummaryResponse.RiskInfo("Nguyễn Văn A", "USER", 45.0, 3, "HIGH"), new AnalyticsSummaryResponse.RiskInfo("Trần Thị B", "USER", 52.0, 1, "MEDIUM")));
    }

    @Transactional(readOnly = true)
    public SummarySubData.RankingData getRankings(UUID orgUnitId, UUID rankingUnitId, String period) {
        OrgUnit targetUnit = getTargetUnit(orgUnitId);
        OrgUnit rankUnit = rankingUnitId != null ? orgUnitRepository.findById(rankingUnitId).orElse(targetUnit) : targetUnit;
        List<UUID> subtree = getSubtreeIds(rankUnit);
        List<AnalyticsSummaryResponse.RankingItem> items = userRoleOrgUnitRepository.findAll().stream()
            .filter(m -> subtree.contains(m.getOrgUnit().getId()))
            .map(m -> {
                UUID uid = m.getUser().getId();
                long assigned = kpiCriteriaRepository.countByAssigneeAndStatus(uid, KpiStatus.APPROVED);
                long completed = submissionRepository.countBySubmittedByIdAndStatus(uid, SubmissionStatus.APPROVED);
                Double avgScore = evaluationRepository.avgScoreByUserId(uid);
                
                double perfPercent = assigned > 0 ? (double) completed / assigned * 100.0 : 0;
                
                return new AnalyticsSummaryResponse.RankingItem(
                    m.getUser().getFullName(), 
                    null, 
                    avgScore != null ? avgScore : 0, 
                    perfPercent, 
                    completed,
                    m.getOrgUnit().getName()
                );
            }).toList();
        List<AnalyticsSummaryResponse.RankingOption> opts = new ArrayList<>();
        opts.add(new AnalyticsSummaryResponse.RankingOption(targetUnit.getId(), "Tổng (" + targetUnit.getName() + ")"));
        orgUnitRepository.findByParentId(targetUnit.getId()).forEach(u -> opts.add(new AnalyticsSummaryResponse.RankingOption(u.getId(), u.getName())));
        return new SummarySubData.RankingData(items.stream().sorted((a,b) -> Double.compare(b.getScore(), a.getScore())).limit(50).toList(), items.stream().sorted((a,b) -> Double.compare(b.getPerformance(), a.getPerformance())).limit(10).toList(), opts);
    }

    private OrgUnit getTargetUnit(UUID orgUnitId) {
        User u = getCurrentUser();
        OrgUnit userUnit = userRoleOrgUnitRepository.findByUserId(u.getId()).get(0).getOrgUnit();
        OrgUnit target = orgUnitId != null ? orgUnitRepository.findById(orgUnitId).orElse(userUnit) : userUnit;
        return target.getPath().startsWith(userUnit.getPath()) ? target : userUnit;
    }

    private Instant getStartInstant(String period) {
        if ("ALL".equals(period)) return null;
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
        switch (period) {
            case "TODAY": return now.truncatedTo(java.time.temporal.ChronoUnit.DAYS).toInstant();
            case "WEEK": return now.minusWeeks(1).toInstant();
            case "QUARTER": return now.minusMonths(3).toInstant();
            case "HALF_YEAR": return now.minusMonths(6).toInstant();
            case "YEAR": return now.minusYears(1).toInstant();
            default: return now.minusMonths(1).toInstant();
        }
    }
}
