package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrgUnitStatisticTool {

    private final OrgUnitRepository orgUnitRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final ObjectMapper objectMapper;

    // Helper to parse dates from string
    private Instant parseDate(String dateStr, Instant defaultInstant) {
        if (dateStr == null || dateStr.isBlank()) return defaultInstant;
        try {
            if (dateStr.length() == 10) { // YYYY-MM-DD
                return java.time.LocalDate.parse(dateStr).atStartOfDay(ZoneId.systemDefault()).toInstant();
            }
            return Instant.parse(dateStr);
        } catch (Exception e) {
            log.warn("Could not parse date: {}. Using default.", dateStr);
            return defaultInstant;
        }
    }

    private String getPathPrefix(UUID id) {
        OrgUnit unit = orgUnitRepository.findById(id).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + id));
        return unit.getPath();
    }

    private UUID getOrgUnitId(ToolContext context) {
        Object id = context.getContext().get("orgUnitId");
        if (id == null) {
            // Fallback to organizationUnitId if orgUnitId is not found
            id = context.getContext().get("organizationUnitId");
        }
        if (id == null) {
            throw new RuntimeException("orgUnitId not found in ToolContext");
        }
        return UUID.fromString(id.toString());
    }

    // 1. Top những người có đánh giá cao nhất, thấp nhất
    @Tool(name = "get_subtree_evaluation_performers", description = "Rank users by average evaluation score within the current organizational unit's subtree.")
    public String getTopPerformersByEvaluation(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Ranking order: 'top' for highest, 'low' for lowest.") String order,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data;
            if ("low".equalsIgnoreCase(order)) {
                data = evaluationRepository.findLowPerformersInSubtree(pathPrefix, start, end, effectiveLimit);
            } else {
                data = evaluationRepository.findTopPerformersInSubtree(pathPrefix, start, end, effectiveLimit);
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("averageScore", row[3] != null ? Math.round(((Number) row[3]).doubleValue() * 100.0) / 100.0 : null);
                entry.put("evaluationCount", row[4]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getTopPerformersByEvaluation", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 2. Trung bình đánh giá
    @Tool(name = "get_subtree_avg_evaluation_score", description = "Calculate average evaluation score for the current organizational unit and its subtree.")
    public String getAvgEvaluationScore(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            String pathPrefix = getPathPrefix(orgUnitId);
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            Double avg = evaluationRepository.findAvgScoreInSubtree(pathPrefix, start, end);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", orgUnitId);
            result.put("averageScore", avg != null ? Math.round(avg * 100.0) / 100.0 : null);
            result.put("startDate", start.toString());
            result.put("endDate", end.toString());

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getAvgEvaluationScore", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 3. Mức độ hoàn thành KPI
    @Tool(name = "get_subtree_kpi_completion_rate", description = "Calculate the KPI completion rate (percentage of approved submissions) for the current organizational unit's subtree.")
    public String getKpiCompletionRate(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            List<Object[]> statusCounts = kpiSubmissionRepository.countGroupByStatusInSubtree(pathPrefix, start, end);
            long total = 0;
            long approved = 0;

            for (Object[] row : statusCounts) {
                long count = ((Number) row[1]).longValue();
                total += count;
                if ("APPROVED".equalsIgnoreCase(row[0].toString())) {
                    approved = count;
                }
            }

            double rate = total > 0 ? Math.round((double) approved / total * 10000.0) / 100.0 : 0.0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", getOrgUnitId(context));
            result.put("completionRate", rate + "%");
            result.put("approvedCount", approved);
            result.put("totalSubmissions", total);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getKpiCompletionRate", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 4. Tổng số KPI
    @Tool(name = "get_subtree_total_kpi_count", description = "Total number of KPI criteria assigned within the current organizational unit's subtree.")
    public String getTotalKpiCount(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            long count = kpiCriteriaRepository.countInSubtree(pathPrefix, start, end);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", getOrgUnitId(context));
            result.put("totalKpiCount", count);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getTotalKpiCount", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 5. Số bài nộp KPI theo trạng thái
    @Tool(name = "get_subtree_submission_status_breakdown", description = "Breakdown of KPI submission counts by status (approved, rejected, pending) in the current organizational unit's subtree.")
    public String getSubmissionStatusBreakdown(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            List<Object[]> statusCounts = kpiSubmissionRepository.countGroupByStatusInSubtree(pathPrefix, start, end);
            Map<String, Long> breakdown = new LinkedHashMap<>();
            long total = 0;

            for (Object[] row : statusCounts) {
                long count = ((Number) row[1]).longValue();
                breakdown.put(row[0].toString().toLowerCase(), count);
                total += count;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", getOrgUnitId(context));
            result.put("totalSubmissions", total);
            result.put("statusBreakdown", breakdown);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getSubmissionStatusBreakdown", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 6. Top những người có tỉ lệ hoàn thành KPI nhiều nhất, thấp nhất
    @Tool(name = "get_subtree_kpi_completion_performers", description = "Rank users by KPI completion rate within the current organizational unit's subtree.")
    public String getTopPerformersByCompletion(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Ranking order: 'top' for highest, 'low' for lowest.") String order,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data;
            if ("low".equalsIgnoreCase(order)) {
                data = kpiSubmissionRepository.findLowPerformersByCompletionInSubtree(pathPrefix, start, end, effectiveLimit);
            } else {
                data = kpiSubmissionRepository.findTopPerformersByCompletionInSubtree(pathPrefix, start, end, effectiveLimit);
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("completionRate", Math.round(((Number) row[3]).doubleValue() * 100.0) / 100.0 + "%");
                entry.put("submissionCount", row[4]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getTopPerformersByCompletion", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 7. Top những đơn vị con có tỉ lệ hoàn thành KPI nhiều nhất, thấp nhất
    @Tool(name = "get_subtree_unit_kpi_completion_rankings", description = "Rank child units by KPI completion rate within the current organizational unit's subtree.")
    public String getTopUnitsByCompletion(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Ranking order: 'top' for highest, 'low' for lowest.") String order,
            @ToolParam(description = "Max number of units to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data;
            if ("low".equalsIgnoreCase(order)) {
                data = kpiSubmissionRepository.findLowUnitsByCompletionInSubtree(pathPrefix, start, end, effectiveLimit);
            } else {
                data = kpiSubmissionRepository.findTopUnitsByCompletionInSubtree(pathPrefix, start, end, effectiveLimit);
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("orgUnitId", row[0]);
                entry.put("orgUnitName", row[1]);
                entry.put("completionRate", Math.round(((Number) row[2]).doubleValue() * 100.0) / 100.0 + "%");
                entry.put("submissionCount", row[3]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getTopUnitsByCompletion", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 8. Hiệu suất trong đơn vị (actual_value/target_value) * 100
    @Tool(name = "get_subtree_avg_performance", description = "Average performance percentage (actual/target * 100) for approved KPI submissions in the current organizational unit's subtree.")
    public String getUnitPerformanceSummary(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            Double avgPerf = kpiSubmissionRepository.findAvgPerformanceInSubtree(pathPrefix, start, end);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", getOrgUnitId(context));
            result.put("averagePerformance", avgPerf != null ? Math.round(avgPerf * 100.0) / 100.0 + "%" : null);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getUnitPerformanceSummary", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 9. Phân bổ hiệu suất (thấp hơn mong đợi, vượt mong đợi, đúng như mong đợi)
    @Tool(name = "get_subtree_performance_distribution", description = "Count of approved KPI submissions by performance category (Below, Met, Exceed Expectations) in the current organizational unit's subtree.")
    public String getPerformanceDistribution(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());

            List<Object[]> data = kpiSubmissionRepository.findPerformanceDistributionInSubtree(pathPrefix, start, end);
            Map<String, Long> distribution = new LinkedHashMap<>();
            distribution.put("below", 0L);
            distribution.put("met", 0L);
            distribution.put("exceed", 0L);

            for (Object[] row : data) {
                distribution.put(row[0].toString().toLowerCase(), ((Number) row[1]).longValue());
            }

            return objectMapper.writeValueAsString(distribution);
        } catch (Exception e) {
            log.error("Error in getPerformanceDistribution", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 10. Top những người có hiệu suất cao nhất và thấp nhất
    @Tool(name = "get_subtree_performance_performers", description = "Rank users by average performance percentage (actual/target * 100) within the current organizational unit's subtree.")
    public String getTopPerformersByPerformance(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Ranking order: 'top' for highest, 'low' for lowest.") String order,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data;
            if ("low".equalsIgnoreCase(order)) {
                data = kpiSubmissionRepository.findLowPerformersByPerformanceInSubtree(pathPrefix, start, end, effectiveLimit);
            } else {
                data = kpiSubmissionRepository.findTopPerformersByPerformanceInSubtree(pathPrefix, start, end, effectiveLimit);
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("performance", row[3] != null ? Math.round(((Number) row[3]).doubleValue() * 100.0) / 100.0 + "%" : null);
                entry.put("submissionCount", row[4]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getTopPerformersByPerformance", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 11. Top những đơn vị có hiệu suất cao nhất và thấp nhất
    @Tool(name = "get_subtree_unit_performance_rankings", description = "Rank child units by average performance percentage within the current organizational unit's subtree.")
    public String getTopUnitsByPerformance(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Ranking order: 'top' for highest, 'low' for lowest.") String order,
            @ToolParam(description = "Max number of units to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data;
            if ("low".equalsIgnoreCase(order)) {
                data = kpiSubmissionRepository.findLowUnitsByPerformanceInSubtree(pathPrefix, start, end, effectiveLimit);
            } else {
                data = kpiSubmissionRepository.findTopUnitsByPerformanceInSubtree(pathPrefix, start, end, effectiveLimit);
            }

            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("orgUnitId", row[0]);
                entry.put("orgUnitName", row[1]);
                entry.put("performance", row[2] != null ? Math.round(((Number) row[2]).doubleValue() * 100.0) / 100.0 + "%" : null);
                entry.put("submissionCount", row[3]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getTopUnitsByPerformance", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 12. Top những người hay trễ deadline của kpi nhất
    @Tool(name = "get_subtree_most_late_users", description = "Rank users who most frequently submit KPIs after the deadline within the current organizational unit's subtree.")
    public String getMostLateUsers(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data = kpiSubmissionRepository.findTopLateSubmittersInSubtree(pathPrefix, start, end, effectiveLimit);
            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("lateSubmissionCount", row[3]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getMostLateUsers", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 13. Top những người hay không nộp kpi nhất
    @Tool(name = "get_subtree_most_non_submitters", description = "Rank users who have the most assigned KPIs without any submissions within the current organizational unit's subtree.")
    public String getMostNonSubmitters(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data = kpiCriteriaRepository.findTopNonSubmittersInSubtree(pathPrefix, start, end, effectiveLimit);
            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("missingSubmissionCount", row[3]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getMostNonSubmitters", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 14. Top những người hay có hiệu suất làm việc thấp hơn mong đợi so với chỉ tiêu kpi
    @Tool(name = "get_subtree_most_underperformers", description = "Rank users who most frequently have approved KPI submissions with performance below 90% within the current organizational unit's subtree.")
    public String getMostUnderperformers(
            @ToolParam(description = "Start date for filtering (YYYY-MM-DD or ISO).") String startDate,
            @ToolParam(description = "End date for filtering (YYYY-MM-DD or ISO).") String endDate,
            @ToolParam(description = "Max number of users to return.") int limit,
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            Instant start = parseDate(startDate, Instant.EPOCH);
            Instant end = parseDate(endDate, Instant.now());
            int effectiveLimit = limit > 0 ? limit : 5;

            List<Object[]> data = kpiSubmissionRepository.findTopUnderperformersInSubtree(pathPrefix, start, end, effectiveLimit);
            List<Map<String, Object>> resultList = new ArrayList<>();
            int rank = 1;
            for (Object[] row : data) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("rank", rank++);
                entry.put("userId", row[0]);
                entry.put("fullName", row[1]);
                entry.put("email", row[2]);
                entry.put("underperformSubmissionCount", row[3]);
                resultList.add(entry);
            }

            return objectMapper.writeValueAsString(resultList);
        } catch (Exception e) {
            log.error("Error in getMostUnderperformers", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 15. Vai trò và tổng số người sở hữu chúng trong đơn vị
    @Tool(name = "get_subtree_role_distribution", description = "Get distribution of roles and the count of users holding each role within the current organizational unit's subtree.")
    public String getRoleDistribution(
            ToolContext context) {
        try {
            String pathPrefix = getPathPrefix(getOrgUnitId(context));
            List<Object[]> data = userRoleOrgUnitRepository.findRoleDistributionInSubtree(pathPrefix);
            
            Map<String, Long> distribution = new LinkedHashMap<>();
            for (Object[] row : data) {
                distribution.put(row[0].toString(), ((Number) row[1]).longValue());
            }

            return objectMapper.writeValueAsString(distribution);
        } catch (Exception e) {
            log.error("Error in getRoleDistribution", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // 16. Tổng số tất cả đơn vị con ở dưới
    @Tool(name = "get_subtree_unit_count", description = "Total count of all descendant organizational units under the current unit.")
    public String getSubtreeUnitCount(
            ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            String pathPrefix = getPathPrefix(orgUnitId);
            long count = orgUnitRepository.countChildrenInSubtree(pathPrefix);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orgUnitId", orgUnitId);
            result.put("descendantUnitCount", count);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in getSubtreeUnitCount", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
