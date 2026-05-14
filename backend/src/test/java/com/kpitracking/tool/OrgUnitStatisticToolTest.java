package com.kpitracking.tool;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
        toolContext = new ToolContext(Map.of("orgUnitId", HANOI_BRANCH_ID));
    }

    @Test
    void getTopPerformersByEvaluation_Success() throws Exception {
        String result = orgUnitStatisticTool.getTopPerformersByEvaluation(null, null, "top", 5, toolContext);
        List<Map<String, Object>> performers = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        
        assertFalse(performers.isEmpty());
        assertEquals("Phạm Thị Staff", performers.get(0).get("fullName"));
        assertEquals(8.17, ((Number) performers.get(0).get("averageScore")).doubleValue());
    }

    @Test
    void getAvgEvaluationScore_Success() throws Exception {
        String result = orgUnitStatisticTool.getAvgEvaluationScore(null, null, toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals(HANOI_BRANCH_ID, resultMap.get("orgUnitId"));
        assertEquals(8.17, ((Number) resultMap.get("averageScore")).doubleValue());
    }

    @Test
    void getKpiCompletionRate_Success() throws Exception {
        String result = orgUnitStatisticTool.getKpiCompletionRate(null, null, toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals("80.0%", resultMap.get("completionRate"));
        assertEquals(8, ((Number) resultMap.get("approvedCount")).intValue());
        assertEquals(10, ((Number) resultMap.get("totalSubmissions")).intValue());
    }

    @Test
    void getTotalKpiCount_Success() throws Exception {
        String result = orgUnitStatisticTool.getTotalKpiCount(null, null, toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals(10, ((Number) resultMap.get("totalKpiCount")).intValue());
    }

    @Test
    void getSubmissionStatusBreakdown_Success() throws Exception {
        String result = orgUnitStatisticTool.getSubmissionStatusBreakdown(null, null, toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals(10, ((Number) resultMap.get("totalSubmissions")).intValue());
        Map<String, Integer> statusBreakdown = (Map<String, Integer>) resultMap.get("statusBreakdown");
        assertEquals(8, statusBreakdown.get("approved"));
        assertEquals(1, statusBreakdown.get("pending"));
        assertEquals(1, statusBreakdown.get("rejected"));
    }

    @Test
    void getTopPerformersByCompletion_Success() throws Exception {
        String result = orgUnitStatisticTool.getTopPerformersByCompletion(null, null, "top", 5, toolContext);
        List<Map<String, Object>> performers = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        
        assertFalse(performers.isEmpty());
        assertEquals("Trần Thị Head", performers.get(0).get("fullName"));
        assertEquals("100.0%", performers.get(0).get("completionRate"));
    }

    @Test
    void getTopUnitsByCompletion_Success() throws Exception {
        String result = orgUnitStatisticTool.getTopUnitsByCompletion(null, null, "top", 5, toolContext);
        List<Map<String, Object>> units = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        
        assertFalse(units.isEmpty());
    }

    @Test
    void getUnitPerformanceSummary_Success() throws Exception {
        String result = orgUnitStatisticTool.getUnitPerformanceSummary(null, null, toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals("71.01%", resultMap.get("averagePerformance"));
    }

    @Test
    void getPerformanceDistribution_Success() throws Exception {
        String result = orgUnitStatisticTool.getPerformanceDistribution(null, null, toolContext);
        Map<String, Integer> distribution = objectMapper.readValue(result, Map.class);
        
        assertEquals(6, distribution.get("below"));
        assertEquals(1, distribution.get("met"));
        assertEquals(1, distribution.get("exceed"));
    }

    @Test
    void getMostLateUsers_Success() throws Exception {
        String result = orgUnitStatisticTool.getMostLateUsers(null, null, 5, toolContext);
        List<Map<String, Object>> data = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        assertNotNull(data);
    }

    @Test
    void getMostNonSubmitters_Success() throws Exception {
        String result = orgUnitStatisticTool.getMostNonSubmitters(null, null, 5, toolContext);
        List<Map<String, Object>> data = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        assertNotNull(data);
    }

    @Test
    void getMostUnderperformers_Success() throws Exception {
        String result = orgUnitStatisticTool.getMostUnderperformers(null, null, 5, toolContext);
        List<Map<String, Object>> data = objectMapper.readValue(result, new TypeReference<List<Map<String, Object>>>() {});
        assertNotNull(data);
    }

    @Test
    void getRoleDistribution_Success() throws Exception {
        String result = orgUnitStatisticTool.getRoleDistribution(toolContext);
        Map<String, Integer> distribution = objectMapper.readValue(result, Map.class);
        assertFalse(distribution.isEmpty());
    }

    @Test
    void getSubtreeUnitCount_Success() throws Exception {
        String result = orgUnitStatisticTool.getSubtreeUnitCount(toolContext);
        Map<String, Object> resultMap = objectMapper.readValue(result, Map.class);
        
        assertEquals(6, ((Number) resultMap.get("descendantUnitCount")).intValue());
    }
}
