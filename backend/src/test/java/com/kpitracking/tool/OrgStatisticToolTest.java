package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrgStatisticToolTest {

    @Autowired
    private OrgStatisticTool orgStatisticTool;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID orgId;
    private ToolContext toolContext;

    @BeforeEach
    void setUp() {
        // Using the real organization ID from V2__seed_data.sql (FPT Education)
        orgId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        Map<String, Object> contextMap = new HashMap<>();
        contextMap.put("organizationId", orgId.toString());
        toolContext = new ToolContext(contextMap);
    }

    @Test
    void getOrgOverview_Success() throws Exception {
        String result = orgStatisticTool.getOrgOverview(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // Based on real seed data for FPT Education: 9 active units
        assertEquals(9, ((Number) resultMap.get("totalUnits")).intValue());
        
        Map<String, Object> statusBreakdown = (Map<String, Object>) resultMap.get("statusBreakdown");
        assertEquals(9, ((Number) statusBreakdown.get("active")).intValue());
        assertEquals(0, ((Number) statusBreakdown.get("suspended")).intValue());
    }

    @Test
    void getOrgHierarchySummary_Success() throws Exception {
        String result = orgStatisticTool.getOrgHierarchySummary(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // FPT Education has 9 nodes in total
        assertEquals(9, ((Number) resultMap.get("totalNodes")).intValue());
        
        List<Map<String, Object>> levels = (List<Map<String, Object>>) resultMap.get("hierarchyLevels");
        // FPT Education has 3 levels: Chi nhánh (1), Phòng ban (2), Tổ (3)
        assertEquals(3, levels.size());
    }

    @Test
    void getKpiCompletionRate_Success() throws Exception {
        String result = orgStatisticTool.getKpiCompletionRate(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // Based on seed data: 10 approved criteria, 11 total submissions, 9 approved submissions
        assertEquals(10, ((Number) resultMap.get("totalKpiCriteria")).intValue());
        assertEquals(11, ((Number) resultMap.get("totalSubmissions")).intValue());
        
        // Approved / Total = 9 / 11 = 81.82%
        assertEquals("81.82%", resultMap.get("completionRate"));
    }

    @Test
    void getKpiScoreSummary_Success() throws Exception {
        String result = orgStatisticTool.getKpiScoreSummary(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // FPT Education has 3 evaluations in seed data
        assertEquals(3, ((Number) resultMap.get("totalEvaluations")).intValue());
        // Average score (8.5 + 9.0 + 7.0) / 3 = 8.166... rounded to 8.17
        assertEquals(8.17, ((Number) resultMap.get("averageScore")).doubleValue());
        assertEquals(9.0, ((Number) resultMap.get("highestScore")).doubleValue());
        assertEquals(7.0, ((Number) resultMap.get("lowestScore")).doubleValue());
    }

    @Test
    void getKpiTrend_Month_Success() throws Exception {
        String result = orgStatisticTool.getKpiTrend("month", toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertEquals("month", resultMap.get("groupedBy"));
        
        List<Map<String, Object>> dataPoints = (List<Map<String, Object>>) resultMap.get("dataPoints");
        // We have evaluations in April and May 2026
        assertEquals(2, dataPoints.size());
        
        // Sorting check (April comes before May)
        Map<String, Object> april = dataPoints.get(0);
        Map<String, Object> may = dataPoints.get(1);
        
        assertEquals(7.0, ((Number) april.get("averageScore")).doubleValue());
        assertEquals(8.75, ((Number) may.get("averageScore")).doubleValue());
    }

    @Test
    void compareOrgUnitsKpi_Success() throws Exception {
        String result = orgStatisticTool.compareOrgUnitsKpi(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        List<Map<String, Object>> rankings = (List<Map<String, Object>>) resultMap.get("rankings");
        // Only "Phòng IT" has evaluations in seed data
        assertEquals(1, rankings.size());
        assertEquals("Phòng IT", rankings.get(0).get("orgUnitName"));
        assertEquals(8.17, ((Number) rankings.get(0).get("averageScore")).doubleValue());
    }

    @Test
    void getSubmissionStatusSummary_Success() throws Exception {
        String result = orgStatisticTool.getSubmissionStatusSummary(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // 11 total submissions in seed data
        assertEquals(11, ((Number) resultMap.get("totalSubmissions")).intValue());
        
        Map<String, Object> breakdown = (Map<String, Object>) resultMap.get("statusBreakdown");
        // 9 approved, 1 pending, 1 rejected
        assertEquals(9, ((Number) breakdown.get("approved")).intValue());
        assertEquals(1, ((Number) breakdown.get("pending")).intValue());
        assertEquals(1, ((Number) breakdown.get("rejected")).intValue());
    }

    @Test
    void getLateSubmissions_Success() throws Exception {
        String result = orgStatisticTool.getLateSubmissions(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // Seed data has no submissions with period_end, so late count should be 0
        assertEquals(0, ((Number) resultMap.get("lateCount")).intValue());
        List<Map<String, Object>> lateList = (List<Map<String, Object>>) resultMap.get("lateSubmissions");
        assertTrue(lateList.isEmpty());
    }

    @Test
    void getTopPerformers_Success() throws Exception {
        String result = orgStatisticTool.getTopPerformers(5, toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertEquals(5, resultMap.get("limit"));
        
        List<Map<String, Object>> performers = (List<Map<String, Object>>) resultMap.get("performers");
        // Only "Nguyễn Văn Director" or "Phạm Thị Staff"? Wait, User ID d1000000-0000-0000-0000-000000000004 is "Phạm Thị Staff"
        assertEquals(1, performers.size());
        assertEquals("Phạm Thị Staff", performers.get(0).get("fullName"));
        assertEquals(8.17, ((Number) performers.get(0).get("averageScore")).doubleValue());
    }

    @Test
    void getLowPerformers_Success() throws Exception {
        String result = orgStatisticTool.getLowPerformers(5, toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertEquals(5, resultMap.get("limit"));
        
        List<Map<String, Object>> performers = (List<Map<String, Object>>) resultMap.get("performers");
        // Same 1 user as top performer
        assertEquals(1, performers.size());
        assertEquals("Phạm Thị Staff", performers.get(0).get("fullName"));
        assertEquals(8.17, ((Number) performers.get(0).get("averageScore")).doubleValue());
    }

    @Test
    void getUserKpiSummary_Success() throws Exception {
        // Staff user ID from seed data: d1000000-0000-0000-0000-000000000004
        String userId = "d1000000-0000-0000-0000-000000000004";
        String result = orgStatisticTool.getUserKpiSummary(userId);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertEquals(userId, resultMap.get("userId"));
        
        Map<String, Object> evalStats = (Map<String, Object>) resultMap.get("evaluationStats");
        // User 4 has 3 evaluations in seed data
        assertEquals(3, ((Number) evalStats.get("totalEvaluations")).intValue());
    }

    @Test
    void getNotificationSummary_Success() throws Exception {
        String result = orgStatisticTool.getNotificationSummary(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        // FPT Education has 4 notifications for org units in seed data
        assertEquals(4, ((Number) resultMap.get("totalNotifications")).intValue());
        // 1 read, 3 unread -> 25.0% read rate
        assertEquals("25.0%", resultMap.get("readRate"));
    }

    @Test
    void getReviewBottlenecks_Success() throws Exception {
        String result = orgStatisticTool.getReviewBottlenecks(5, toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        assertEquals(5, resultMap.get("limit"));
        
        List<Map<String, Object>> bottlenecks = (List<Map<String, Object>>) resultMap.get("bottlenecks");
        // Only 1 pending submission (e1000000-0000-0000-0000-000000000003)
        assertEquals(1, bottlenecks.size());
    }

    @Test
    void generateKpiInsights_Success() throws Exception {
        String result = orgStatisticTool.generateKpiInsights(toolContext);

        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        Map<String, Object> completion = (Map<String, Object>) resultMap.get("completionOverview");
        assertEquals("82.0%", completion.get("completionRate"));
        assertEquals(8.17, ((Number) resultMap.get("globalAverageScore")).doubleValue());
        
        List<Map<String, Object>> trends = (List<Map<String, Object>>) resultMap.get("recentMonthlyTrends");
        assertEquals(2, trends.size());
    }
}
