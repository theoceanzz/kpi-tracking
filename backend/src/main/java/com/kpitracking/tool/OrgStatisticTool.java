package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.OrgUnitStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.NotificationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrgStatisticTool {

    private final OrgUnitRepository orgUnitRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    private UUID getOrgId(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object orgId = context.getContext().get("organizationId");
        if (orgId == null) return null;
        if (orgId instanceof UUID) return (UUID) orgId;
        if (orgId instanceof String) return UUID.fromString((String) orgId);
        return null;
    }

    @Tool(name = "get_org_overview", description = "Summary of org units and status distribution (active, suspended, trial, inactive). Use for general organization summary or total unit counts.")
    public String getOrgOverview(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            long totalUnits = orgUnitRepository.countAllActiveByOrgId(orgId);
            long activeCount = orgUnitRepository.countByStatusAndOrgHierarchyLevel_Organization_Id(OrgUnitStatus.ACTIVE, orgId);
            long suspendedCount = orgUnitRepository.countByStatusAndOrgHierarchyLevel_Organization_Id(OrgUnitStatus.SUSPENDED, orgId);
            long trialCount = orgUnitRepository.countByStatusAndOrgHierarchyLevel_Organization_Id(OrgUnitStatus.TRIAL, orgId);
            long inactiveCount = orgUnitRepository.countByStatusAndOrgHierarchyLevel_Organization_Id(OrgUnitStatus.INACTIVE, orgId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalUnits", totalUnits);

            Map<String, Long> statusBreakdown = new LinkedHashMap<>();
            statusBreakdown.put("active", activeCount);
            statusBreakdown.put("suspended", suspendedCount);
            statusBreakdown.put("trial", trialCount);
            statusBreakdown.put("inactive", inactiveCount);
            result.put("statusBreakdown", statusBreakdown);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getOrgOverview", e);
            return "{\"error\": \"Failed to retrieve organization overview\"}";
        }
    }

    @Tool(name = "get_org_hierarchy_summary", description = "Statistical summary of organization hierarchy (headquarters, branch, department) and level distribution. Use for tree structure or level-based counts.")
    public String getOrgHierarchySummary(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            List<Object[]> levelCounts = orgUnitRepository.countGroupByHierarchyLevelOrderedByOrgId(orgId);
            long totalUnits = orgUnitRepository.countAllActiveByOrgId(orgId);

            List<Map<String, Object>> levels = new ArrayList<>();
            for (Object[] row : levelCounts) {
                Map<String, Object> level = new LinkedHashMap<>();
                level.put("levelName", row[0]);
                level.put("levelOrder", row[1]);
                level.put("unitCount", row[2]);
                levels.add(level);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalNodes", totalUnits);
            result.put("hierarchyLevels", levels);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getOrgHierarchySummary", e);
            return "{\"error\": \"Failed to retrieve organization hierarchy summary\"}";
        }
    }

    @Tool(name = "get_kpi_completion_rate", description = "KPI completion metrics including total criteria, submissions, and status breakdown (approved/pending/rejected).")
    public String getKpiCompletionRate(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            long totalCriteria = kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.APPROVED);
            long totalSubmissions = kpiSubmissionRepository.countByOrganizationId(orgId);
            long approvedSubmissions = kpiSubmissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.APPROVED);
            long pendingSubmissions = kpiSubmissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.PENDING);
            long rejectedSubmissions = kpiSubmissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.REJECTED);

            double completionRate = totalSubmissions > 0
                    ? Math.round((double) approvedSubmissions / totalSubmissions * 10000.0) / 100.0
                    : 0.0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalKpiCriteria", totalCriteria);
            result.put("totalSubmissions", totalSubmissions);

            Map<String, Long> submissionBreakdown = new LinkedHashMap<>();
            submissionBreakdown.put("approved", approvedSubmissions);
            submissionBreakdown.put("pending", pendingSubmissions);
            submissionBreakdown.put("rejected", rejectedSubmissions);
            result.put("submissionBreakdown", submissionBreakdown);

            result.put("completionRate", completionRate + "%");

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getKpiCompletionRate", e);
            return "{\"error\": \"Failed to retrieve KPI completion rate\"}";
        }
    }

    @Tool(name = "get_kpi_score_summary", description = "Global KPI score statistics: average, highest, and lowest scores.")
    public String getKpiScoreSummary(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            Double avgScore = evaluationRepository.avgScoreAllByOrgId(orgId);
            Double minScore = evaluationRepository.minScoreAllByOrgId(orgId);
            Double maxScore = evaluationRepository.maxScoreAllByOrgId(orgId);
            long totalEvaluations = evaluationRepository.countAllByOrgId(orgId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalEvaluations", totalEvaluations);
            result.put("averageScore", avgScore != null ? Math.round(avgScore * 100.0) / 100.0 : null);
            result.put("highestScore", maxScore);
            result.put("lowestScore", minScore);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getKpiScoreSummary", e);
            return "{\"error\": \"Failed to retrieve KPI score summary\"}";
        }
    }

    @Tool(name = "get_kpi_trend", description = "Chronological KPI score trends grouped by month, quarter, or year.")
    public String getKpiTrend(
            @ToolParam(description = "The time period to group by. Accepted values: 'month' (group by YYYY-MM), 'quarter' (group by YYYY-QN), 'year' (group by YYYY). Default to 'month' if the user does not specify.") String period,
            ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            String datePattern;
            switch (period.toLowerCase()) {
                case "quarter":
                    datePattern = "YYYY-\"Q\"Q";
                    break;
                case "year":
                    datePattern = "YYYY";
                    break;
                case "month":
                default:
                    datePattern = "YYYY-MM";
                    break;
            }

            List<Object[]> trendData = evaluationRepository.trendGroupByPeriodByOrgId(orgId, datePattern);

            List<Map<String, Object>> trendList = new ArrayList<>();
            for (Object[] row : trendData) {
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("period", row[0]);
                point.put("averageScore", row[1] != null ? Math.round(((Number) row[1]).doubleValue() * 100.0) / 100.0 : null);
                point.put("evaluationCount", row[2]);
                trendList.add(point);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("groupedBy", period.toLowerCase());
            result.put("dataPoints", trendList);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getKpiTrend", e);
            return "{\"error\": \"Failed to retrieve KPI trend data\"}";
        }
    }

    @Tool(name = "compare_org_units_kpi", description = "Compare and rank organizational units (branches/departments) by average KPI scores.")
    public String compareOrgUnitsKpi(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            List<Object[]> data = evaluationRepository.avgScoreGroupByOrgUnitByOrgId(orgId);

            List<Map<String, Object>> rankings = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("orgUnitId", row[0] != null ? row[0].toString() : null);
                entry.put("orgUnitName", row[1]);
                entry.put("averageScore", row[2] != null ? Math.round(((Number) row[2]).doubleValue() * 100.0) / 100.0 : null);
                entry.put("evaluationCount", row[3]);
                rankings.add(entry);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalUnitsWithEvaluations", rankings.size());
            result.put("rankings", rankings);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in compareOrgUnitsKpi", e);
            return "{\"error\": \"Failed to compare org units KPI\"}";
        }
    }

    @Tool(name = "get_submission_status_summary", description = "Summary of KPI submission counts by status (pending, approved, rejected).")
    public String getSubmissionStatusSummary(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            List<Object[]> statusCounts = kpiSubmissionRepository.countGroupByStatusByOrgId(orgId);
            long total = kpiSubmissionRepository.countByOrganizationId(orgId);

            Map<String, Long> breakdown = new LinkedHashMap<>();
            for (Object[] row : statusCounts) {
                breakdown.put(((String) row[0]).toLowerCase(), ((Number) row[1]).longValue());
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalSubmissions", total);
            result.put("statusBreakdown", breakdown);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getSubmissionStatusSummary", e);
            return "{\"error\": \"Failed to retrieve submission status summary\"}";
        }
    }

    @Tool(name = "get_late_submissions", description = "Identify KPI submissions made after the deadline. Returns details of late submitters.")
    public String getLateSubmissions(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            List<Object[]> data = kpiSubmissionRepository.findLateSubmissionsByOrgId(orgId);

            List<Map<String, Object>> lateList = new ArrayList<>();
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("submissionId", row[0] != null ? row[0].toString() : null);
                entry.put("userName", row[1]);
                entry.put("email", row[2]);
                entry.put("orgUnitName", row[3]);
                entry.put("kpiName", row[4]);
                entry.put("submittedAt", row[5] != null ? row[5].toString() : null);
                entry.put("deadline", row[6] != null ? row[6].toString() : null);
                lateList.add(entry);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("lateCount", lateList.size());
            result.put("lateSubmissions", lateList);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getLateSubmissions", e);
            return "{\"error\": \"Failed to retrieve late submissions\"}";
        }
    }

    @Tool(name = "get_top_performers", description = "Leaderboard of employees with the highest average KPI evaluation scores.")
    public String getTopPerformers(
            @ToolParam(description = "Maximum number of top performers to return. Default to 10 if the user does not specify a number.") int limit,
            ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int effectiveLimit = limit > 0 ? limit : 10;
            List<Object[]> data = evaluationRepository.topPerformersByOrgId(orgId, effectiveLimit);

            List<Map<String, Object>> performers = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0] != null ? row[0].toString() : null);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("averageScore", row[3] != null ? Math.round(((Number) row[3]).doubleValue() * 100.0) / 100.0 : null);
                entry.put("evaluationCount", row[4]);
                performers.add(entry);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("limit", effectiveLimit);
            result.put("performers", performers);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getTopPerformers", e);
            return "{\"error\": \"Failed to retrieve top performers\"}";
        }
    }

    @Tool(name = "get_low_performers", description = "List of employees with the lowest KPI scores who may need support.")
    public String getLowPerformers(
            @ToolParam(description = "Maximum number of low performers to return. Default to 10 if the user does not specify a number.") int limit,
            ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int effectiveLimit = limit > 0 ? limit : 10;
            List<Object[]> data = evaluationRepository.lowPerformersByOrgId(orgId, effectiveLimit);

            List<Map<String, Object>> performers = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0] != null ? row[0].toString() : null);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("averageScore", row[3] != null ? Math.round(((Number) row[3]).doubleValue() * 100.0) / 100.0 : null);
                entry.put("evaluationCount", row[4]);
                performers.add(entry);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("limit", effectiveLimit);
            result.put("performers", performers);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getLowPerformers", e);
            return "{\"error\": \"Failed to retrieve low performers\"}";
        }
    }

    @Tool(name = "get_user_kpi_summary", description = "Individual KPI performance and submission summary for a specific user ID.")
    public String getUserKpiSummary(
            @ToolParam(description = "The UUID of the user to retrieve the KPI summary for. Must be a valid UUID string.") String userId) {
        try {
            UUID uid = UUID.fromString(userId);

            Double avgScore = evaluationRepository.avgScoreByUserId(uid);
            Double minScore = evaluationRepository.minScoreByUserId(uid);
            Double maxScore = evaluationRepository.maxScoreByUserId(uid);
            long evalCount = evaluationRepository.countByUserId(uid);

            long totalSubmissions = kpiSubmissionRepository.countBySubmittedById(uid);
            long approvedSubs = kpiSubmissionRepository.countBySubmittedByIdAndStatus(uid, SubmissionStatus.APPROVED);
            long pendingSubs = kpiSubmissionRepository.countBySubmittedByIdAndStatus(uid, SubmissionStatus.PENDING);
            long rejectedSubs = kpiSubmissionRepository.countBySubmittedByIdAndStatus(uid, SubmissionStatus.REJECTED);

            Map<String, Object> evaluationStats = new LinkedHashMap<>();
            evaluationStats.put("averageScore", avgScore != null ? Math.round(avgScore * 100.0) / 100.0 : null);
            evaluationStats.put("highestScore", maxScore);
            evaluationStats.put("lowestScore", minScore);
            evaluationStats.put("totalEvaluations", evalCount);

            Map<String, Object> submissionStats = new LinkedHashMap<>();
            submissionStats.put("totalSubmissions", totalSubmissions);
            submissionStats.put("approved", approvedSubs);
            submissionStats.put("pending", pendingSubs);
            submissionStats.put("rejected", rejectedSubs);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("userId", userId);
            result.put("evaluationStats", evaluationStats);
            result.put("submissionStats", submissionStats);

            return objectMapper.writeValueAsString(result);
        } catch (IllegalArgumentException e) {
            return "{\"error\": \"Invalid user ID format. Please provide a valid UUID.\"}";
        } catch (Exception e) {
            log.error("Error in getUserKpiSummary", e);
            return "{\"error\": \"Failed to retrieve user KPI summary\"}";
        }
    }

    @Tool(name = "get_notification_summary", description = "System-wide notification stats: read vs unread counts and read rate.")
    public String getNotificationSummary(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            long readCount = notificationRepository.countByIsReadTrueByOrgId(orgId);
            long unreadCount = notificationRepository.countByIsReadFalseByOrgId(orgId);
            long total = readCount + unreadCount;

            double readRate = total > 0
                    ? Math.round((double) readCount / total * 10000.0) / 100.0
                    : 0.0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("totalNotifications", total);
            result.put("readCount", readCount);
            result.put("unreadCount", unreadCount);
            result.put("readRate", readRate + "%");

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getNotificationSummary", e);
            return "{\"error\": \"Failed to retrieve notification summary\"}";
        }
    }

    @Tool(name = "get_review_bottlenecks", description = "Identify KPI submissions pending approval for the longest time.")
    public String getReviewBottlenecks(
            @ToolParam(description = "Maximum number of bottleneck records to return. Default to 10 if not specified.") int limit,
            ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int effectiveLimit = limit > 0 ? limit : 10;
            List<Object[]> data = kpiSubmissionRepository.findReviewBottlenecksByOrgId(orgId, effectiveLimit);

            List<Map<String, Object>> bottlenecks = new ArrayList<>();
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("submissionId", row[0] != null ? row[0].toString() : null);
                entry.put("submitterName", row[1]);
                entry.put("email", row[2]);
                entry.put("orgUnitName", row[3]);
                entry.put("kpiName", row[4]);
                entry.put("submittedAt", row[5] != null ? row[5].toString() : null);
                entry.put("daysPending", row[6] != null ? Math.round(((Number) row[6]).doubleValue()) : 0);
                bottlenecks.add(entry);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("limit", effectiveLimit);
            result.put("bottleneckCount", bottlenecks.size());
            result.put("bottlenecks", bottlenecks);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getReviewBottlenecks", e);
            return "{\"error\": \"Failed to retrieve review bottlenecks\"}";
        }
    }

    @Tool(name = "generate_kpi_insights", description = "Retrieve aggregated KPI metrics for high-level AI business insight generation.")
    public String generateKpiInsights(ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            Map<String, Object> insightsData = new LinkedHashMap<>();

            // 1. Completion & Submissions
            long totalCriteria = kpiCriteriaRepository.countByOrganizationIdAndStatus(orgId, KpiStatus.APPROVED);
            long totalSubmissions = kpiSubmissionRepository.countByOrganizationId(orgId);
            long approvedSubmissions = kpiSubmissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.APPROVED);
            long pendingSubmissions = kpiSubmissionRepository.countByOrganizationIdAndStatus(orgId, SubmissionStatus.PENDING);
            double completionRate = totalSubmissions > 0 ? Math.round((double) approvedSubmissions / totalSubmissions * 100.0) : 0.0;

            Map<String, Object> completion = new LinkedHashMap<>();
            completion.put("totalKpiCriteria", totalCriteria);
            completion.put("completionRate", completionRate + "%");
            completion.put("pendingSubmissions", pendingSubmissions);
            insightsData.put("completionOverview", completion);

            // 2. Scores & Trend
            Double avgScore = evaluationRepository.avgScoreAllByOrgId(orgId);
            insightsData.put("globalAverageScore", avgScore != null ? Math.round(avgScore * 100.0) / 100.0 : null);

            List<Object[]> trendData = evaluationRepository.trendGroupByPeriodByOrgId(orgId, "YYYY-MM");
            List<Map<String, Object>> recentTrends = new ArrayList<>();
            // Get last 3 months
            int startIndex = Math.max(0, trendData.size() - 3);
            for (int i = startIndex; i < trendData.size(); i++) {
                Object[] row = trendData.get(i);
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("month", row[0]);
                point.put("averageScore", row[1] != null ? Math.round(((Number) row[1]).doubleValue() * 100.0) / 100.0 : null);
                recentTrends.add(point);
            }
            insightsData.put("recentMonthlyTrends", recentTrends);

            // 3. Org Unit Extremes
            List<Object[]> unitRankings = evaluationRepository.avgScoreGroupByOrgUnitByOrgId(orgId);
            List<Map<String, Object>> topUnits = new ArrayList<>();
            List<Map<String, Object>> bottomUnits = new ArrayList<>();

            for (int i = 0; i < Math.min(3, unitRankings.size()); i++) {
                Object[] row = unitRankings.get(i);
                topUnits.add(Map.of("orgUnitName", row[1], "averageScore", row[2] != null ? Math.round(((Number) row[2]).doubleValue() * 100.0) / 100.0 : 0));
            }
            for (int i = Math.max(0, unitRankings.size() - 3); i < unitRankings.size(); i++) {
                Object[] row = unitRankings.get(i);
                bottomUnits.add(Map.of("orgUnitName", row[1], "averageScore", row[2] != null ? Math.round(((Number) row[2]).doubleValue() * 100.0) / 100.0 : 0));
            }
            // Reverse bottom units so the absolute lowest is first
            Collections.reverse(bottomUnits);

            insightsData.put("topPerformingUnits", topUnits);
            insightsData.put("lowestPerformingUnits", bottomUnits);

            // 4. Bottlenecks
            List<Object[]> bottlenecks = kpiSubmissionRepository.findReviewBottlenecksByOrgId(orgId, 5);
            List<Map<String, Object>> worstBottlenecks = new ArrayList<>();
            for (Object[] row : bottlenecks) {
                worstBottlenecks.add(Map.of("submitterName", row[1], "kpiName", row[4], "daysPending", row[6] != null ? Math.round(((Number) row[6]).doubleValue()) : 0));
            }
            insightsData.put("criticalReviewBottlenecks", worstBottlenecks);

            return objectMapper.writeValueAsString(insightsData);
        } catch (Exception e) {
            log.error("Error generating KPI insights", e);
            return "{\"error\": \"Failed to generate KPI insights dataset\"}";
        }
    }
}
