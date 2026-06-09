package com.kpitracking.tool;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrgUnitStatisticToolTest {

    @Autowired
    private OrgUnitStatisticTool orgUnitStatisticTool;

    @Autowired
    private ObjectMapper objectMapper;

    private ToolContext toolContext;
    private static final String HANOI_BRANCH_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private static final String IT_DEPT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    @BeforeEach
    void setUp() {
        toolContext = new ToolContext(Map.of(
            "orgUnitId", HANOI_BRANCH_ID,
            "organizationId", "11111111-1111-1111-1111-111111111111"
        ));
    }

    @Test
    void getOrgHierarchy_Success() throws Exception {
        String result = orgUnitStatisticTool.getOrgHierarchy(
                new GetOrgHierarchyRequest(null, null), toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertEquals(HANOI_BRANCH_ID, response.get("rootUnitId"));
        assertFalse(((List<?>) response.get("units")).isEmpty());
    }

    @Test
    void getOrgUnitDetail_Success() throws Exception {
        String result = orgUnitStatisticTool.getOrgUnitDetail(
                new GetOrgUnitDetailRequest(IT_DEPT_ID, null, null), toolContext);
        Map<String, Object> detail = objectMapper.readValue(result, Map.class);
        assertNotNull(detail);
        assertEquals(IT_DEPT_ID, detail.get("id"));
        assertEquals("Phòng IT", detail.get("name"));
    }

    @Test
    void getChildOrgUnits_Success() throws Exception {
        String result = orgUnitStatisticTool.getChildOrgUnits(
                new GetChildOrgUnitsRequest(HANOI_BRANCH_ID, false, 1, 5, "o.name", "asc", null, null),
                toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertEquals(HANOI_BRANCH_ID, response.get("parentUnitId"));
        assertNotNull(response.get("units"));
    }

    @Test
    void getMembers_Success() throws Exception {
        String result = orgUnitStatisticTool.getMembers(
                new GetMembersRequest(IT_DEPT_ID, false, null, 1, 10, null, null, null, null),
                toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertFalse(((List<?>) response.get("members")).isEmpty());
    }

    @Test
    void getOrgUnitStatistics_Success() throws Exception {
        String result = orgUnitStatisticTool.getOrgUnitStatistics(
                new GetOrgUnitStatisticsRequest(HANOI_BRANCH_ID, true, null, null, null),
                toolContext);
        Map<String, Object> stats = objectMapper.readValue(result, Map.class);
        assertNotNull(stats);
        assertTrue(stats.containsKey("averageProgress"));
        assertTrue(stats.containsKey("averagePerformance"));
    }

    @Test
    void getUserSummary_Success() throws Exception {
        String result = orgUnitStatisticTool.getUserSummary(
                new GetUserSummaryRequest("22222222-0000-0000-0000-000000000101", null, null),
                toolContext);
        Map<String, Object> summary = objectMapper.readValue(result, Map.class);
        assertNotNull(summary);
        assertEquals("22222222-0000-0000-0000-000000000101", summary.get("userId"));
        assertTrue(summary.containsKey("averageProgress"));
    }

    @Test
    void getKpis_Success() throws Exception {
        String result = orgUnitStatisticTool.getKpis(
                new GetKpisRequest(null, null, null, null, null, 1, 10, null, null, null, null),
                toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertFalse(((List<?>) response.get("kpis")).isEmpty());
    }

    @Test
    void getKpiSummary_Success() throws Exception {
        String result = orgUnitStatisticTool.getKpiSummary(
                new GetKpiSummaryRequest(null, null, null, null, null, null, null),
                toolContext);
        Map<String, Object> summary = objectMapper.readValue(result, Map.class);
        assertNotNull(summary);
        assertTrue(summary.containsKey("totalKpis"));
    }

    @Test
    void getKpiDetail_Success() throws Exception {
        String listResult = orgUnitStatisticTool.getKpis(
                new GetKpisRequest(null, null, null, null, null, 1, 5, null, null, null, null),
                toolContext);
        List<Map<String, Object>> kpis = (List<Map<String, Object>>)
                objectMapper.readValue(listResult, Map.class).get("kpis");
        assertFalse(kpis.isEmpty());
        String kpiId = kpis.get(0).get("id").toString();

        String result = orgUnitStatisticTool.getKpiDetail(
                new GetKpiDetailRequest(kpiId, null, null), toolContext);
        Map<String, Object> detail = objectMapper.readValue(result, Map.class);
        assertNotNull(detail);
        assertEquals(kpiId, detail.get("id"));
    }

    @Test
    void getKpiAssignees_Success() throws Exception {
        String listResult = orgUnitStatisticTool.getKpis(
                new GetKpisRequest(null, null, null, null, null, 1, 5, null, null, null, null),
                toolContext);
        List<Map<String, Object>> kpis = (List<Map<String, Object>>)
                objectMapper.readValue(listResult, Map.class).get("kpis");
        assertFalse(kpis.isEmpty());
        String kpiId = kpis.get(0).get("id").toString();

        String result = orgUnitStatisticTool.getKpiAssignees(
                new GetKpiAssigneesRequest(kpiId, null, null), toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertEquals(kpiId, response.get("kpiId"));
        assertTrue(response.containsKey("assigneesCount"));
    }

    @Test
    void getKpiPeriods_Success() throws Exception {
        String result = orgUnitStatisticTool.getKpiPeriods(
                new GetKpiPeriodsRequest(null, null), toolContext);
        List<Map<String, Object>> periods = objectMapper.readValue(result, new TypeReference<>() {});
        assertNotNull(periods);
        assertFalse(periods.isEmpty());
    }

    @Test
    void getPositions_Success() throws Exception {
        String result = orgUnitStatisticTool.getPositions(
                new GetPositionsRequest(IT_DEPT_ID, null, null), toolContext);
        Map<String, Object> response = objectMapper.readValue(result, Map.class);
        assertNotNull(response);
        assertEquals(IT_DEPT_ID, response.get("unitId"));
        assertTrue(response.containsKey("positionsCount"));
    }

    @Test
    void rankMembers_Success() throws Exception {
        String result = orgUnitStatisticTool.rankMembers(
                new RankMembersRequest("average_performance", "desc", "unit", HANOI_BRANCH_ID, null, 5, null, null),
                toolContext);
        List<Map<String, Object>> ranking = objectMapper.readValue(result, new TypeReference<>() {});
        assertNotNull(ranking);
    }

    @Test
    void rankOrgUnits_Success() throws Exception {
        String result = orgUnitStatisticTool.rankOrgUnits(
                new RankOrgUnitsRequest("average_performance", "desc", 5, null, null),
                toolContext);
        List<Map<String, Object>> ranking = objectMapper.readValue(result, new TypeReference<>() {});
        assertNotNull(ranking);
    }

    @Test
    void getKpiRiskAnalysis_Success() throws Exception {
        String result = orgUnitStatisticTool.getKpiRiskAnalysis(
                new GetKpiRiskAnalysisRequest(null, null), toolContext);
        List<Map<String, Object>> analysis = objectMapper.readValue(result, new TypeReference<>() {});
        assertNotNull(analysis);
    }

    @Test
    void getDashboardSummary_Success() throws Exception {
        String result = orgUnitStatisticTool.getDashboardSummary(
                new GetDashboardSummaryRequest(null, null), toolContext);
        Map<String, Object> summary = objectMapper.readValue(result, Map.class);
        assertNotNull(summary);
        assertTrue(summary.containsKey("totalEmployees"));
        assertTrue(summary.containsKey("totalUnits"));
        assertTrue(summary.containsKey("totalKpis"));
    }
}
