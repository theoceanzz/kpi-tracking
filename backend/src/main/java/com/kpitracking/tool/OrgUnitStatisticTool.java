package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.*;
import com.kpitracking.repository.*;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrgUnitStatisticTool {

    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final OrgUnitStatisticService orgUnitStatisticService;
    private final DisambiguationGuard disambiguationGuard;
    private final FollowupContextStore followupContextStore;
    private final ObjectMapper objectMapper;

    // ── context helpers ──────────────────────────────────────────────────────

    private UUID getOrgUnitId(ToolContext context) {
        if (context == null || context.getContext() == null) {
            UUID id = getCurrentUserOrgUnitId();
            if (id != null) return id;
            throw new RuntimeException("ToolContext is null and could not resolve orgUnitId");
        }
        Object id = context.getContext().get("orgUnitId");
        if (id == null) id = context.getContext().get("organizationUnitId");
        if (id == null) {
            UUID uid = getCurrentUserOrgUnitId();
            if (uid != null) return uid;
            throw new RuntimeException("orgUnitId not found in ToolContext");
        }
        return UUID.fromString(id.toString());
    }

    private UUID getOrgId(ToolContext context) {
        if (context == null || context.getContext() == null) {
            UUID id = getCurrentUserOrgId();
            if (id != null) return id;
            throw new RuntimeException("ToolContext is null and could not resolve organizationId");
        }
        Object orgId = context.getContext().get("organizationId");
        if (orgId == null) {
            UUID id = getCurrentUserOrgId();
            if (id != null) return id;
            throw new RuntimeException("organizationId not found in ToolContext");
        }
        if (orgId instanceof UUID) return (UUID) orgId;
        return UUID.fromString(orgId.toString());
    }

    private UUID getCurrentUserOrgUnitId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            if (assignments.isEmpty()) return null;
            return assignments.get(0).getOrgUnit().getId();
        } catch (Exception e) {
            log.error("Error getting current user org unit ID", e);
            return null;
        }
    }

    private UUID getCurrentUserOrgId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            if (assignments.isEmpty()) return null;
            return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        } catch (Exception e) {
            log.error("Error getting current user org ID", e);
            return null;
        }
    }

    private String getContextPath(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object path = context.getContext().get("orgUnitPath");
        return path != null ? path.toString() : null;
    }

    private void validateSubtreeAccess(UUID targetUnitId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return;
        OrgUnit target = orgUnitRepository.findById(targetUnitId)
                .orElseThrow(() -> new RuntimeException("Đơn vị không tồn tại: " + targetUnitId));
        if (!target.getPath().startsWith(contextPath)) {
            throw new SecurityException("Không có quyền truy cập đơn vị này. Bạn chỉ có thể truy cập đơn vị của mình và các đơn vị con.");
        }
    }

    private UUID resolveUnitId(String unitId, ToolContext context) {
        if (unitId != null && !unitId.isBlank()) {
            UUID targetId = UUID.fromString(unitId);
            guardDisambiguation("orgUnit", targetId, "đơn vị");
            validateSubtreeAccess(targetId, context);
            return targetId;
        }
        return getOrgUnitId(context);
    }

    /**
     * Refuses to act on an ID that was flagged ambiguous (same-named) by a search
     * in the current turn, forcing the assistant to ask the user to choose first.
     */
    private void guardDisambiguation(String entityType, UUID id, String entityLabel) {
        if (disambiguationGuard.isArmed(entityType, id)) {
            throw new IllegalStateException("Có nhiều " + entityLabel + " trùng tên vừa được tìm thấy. "
                    + "Hãy đưa danh sách cho người dùng chọn rồi mới xem chi tiết, không tự chọn giúp.");
        }
    }

    private void validateUserAccess(UUID targetUserId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return;
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(targetUserId);
        if (assignments.isEmpty()) {
            throw new SecurityException("Người dùng không thuộc bất kỳ đơn vị nào.");
        }
        boolean inSubtree = assignments.stream()
                .anyMatch(a -> a.getOrgUnit().getPath().startsWith(contextPath));
        if (!inSubtree) {
            throw new SecurityException("Không có quyền xem thông tin người dùng này. Người dùng không thuộc phạm vi đơn vị của bạn.");
        }
    }

    private void validateKpiAccess(UUID kpiId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return;
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI không tồn tại: " + kpiId));
        if (!kpi.getOrgUnit().getPath().startsWith(contextPath)) {
            throw new SecurityException("Không có quyền truy cập KPI này. KPI không thuộc phạm vi đơn vị của bạn.");
        }
    }

    // ── disambiguation helpers ───────────────────────────────────────────────

    private String getConversationId(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object id = context.getContext().get("conversationId");
        return id != null ? id.toString() : null;
    }

    /**
     * Returns the subset of results whose display name (under {@code nameKey})
     * collides with at least one other result. Empty if every name is unique.
     */
    private List<Map<String, Object>> findDuplicateNameGroup(List<Map<String, Object>> results, String nameKey) {
        Map<String, Long> counts = new HashMap<>();
        for (Map<String, Object> r : results) {
            String name = normalizeName(r.get(nameKey));
            if (name != null) counts.merge(name, 1L, Long::sum);
        }
        List<Map<String, Object>> dup = new ArrayList<>();
        for (Map<String, Object> r : results) {
            String name = normalizeName(r.get(nameKey));
            if (name != null && counts.getOrDefault(name, 0L) >= 2) dup.add(r);
        }
        return dup;
    }

    private String normalizeName(Object value) {
        if (value == null) return null;
        String s = value.toString().trim().toLowerCase();
        return s.isEmpty() ? null : s;
    }

    /**
     * Detects whether we already presented these candidates to the user in a
     * previous turn. Reads the most recent assistant message from chat memory and
     * checks whether it already mentions the distinguishing labels of ≥2 candidates.
     * If so we are in the "answering" phase and must let the detail tool proceed.
     */
    private boolean alreadyAskedPriorTurn(String conversationId, String collisionName,
                                          List<Map<String, Object>> candidates, String... labelKeys) {
        if (conversationId == null) return false;
        String lastAssistant;
        try {
            lastAssistant = conversationMessageRepository
                    .findByConversationIdOrderByMsgIndex(UUID.fromString(conversationId)).stream()
                    .filter(m -> "assistant".equals(m.getRole()))
                    .reduce((first, second) -> second)
                    .map(ConversationMessage::getContent)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not load conversation history for disambiguation check: {}", e.getMessage());
            return false;
        }
        if (lastAssistant == null || lastAssistant.isBlank()) return false;
        String haystack = lastAssistant.toLowerCase();

        // Tie the check to THIS specific collision: the previous assistant turn must
        // mention the colliding name itself. Otherwise the user asked about something
        // else, and a label overlap (e.g. same org units) must NOT be treated as a
        // pending choice — we re-ask instead of silently picking.
        if (collisionName == null || collisionName.isBlank()
                || !haystack.contains(collisionName.trim().toLowerCase())) {
            return false;
        }

        int mentioned = 0;
        for (Map<String, Object> c : candidates) {
            for (String key : labelKeys) {
                Object label = c.get(key);
                if (label != null && !label.toString().isBlank()
                        && haystack.contains(label.toString().toLowerCase())) {
                    mentioned++;
                    break; // count each candidate at most once
                }
            }
        }
        return mentioned >= 2;
    }

    private String collisionName(List<Map<String, Object>> dup, String nameKey) {
        if (dup.isEmpty()) return null;
        Object name = dup.get(0).get(nameKey);
        return name != null ? name.toString() : null;
    }

    private Set<UUID> collectIds(List<Map<String, Object>> items) {
        Set<UUID> ids = new HashSet<>();
        for (Map<String, Object> m : items) {
            Object id = m.get("id");
            if (id != null) {
                try {
                    ids.add(id instanceof UUID ? (UUID) id : UUID.fromString(id.toString()));
                } catch (IllegalArgumentException ignored) {
                    // skip non-UUID ids
                }
            }
        }
        return ids;
    }

    private String ambiguousEnvelope(String entityLabel, String arrayKey, List<Map<String, Object>> results) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "NEEDS_DISAMBIGUATION");
        result.put("message", "Có nhiều " + entityLabel + " trùng tên. Hãy hiển thị danh sách bên dưới (kèm thông tin phân biệt) "
                + "và yêu cầu người dùng chọn đúng mục mong muốn TRƯỚC KHI xem chi tiết.");
        result.put("count", results.size());
        result.put(arrayKey, results);
        return objectMapper.writeValueAsString(result);
    }

    /**
     * Serializes a tool's payload to JSON, records it in the {@link FollowupContextStore}
     * (keyed by conversationId, when present) so follow-up questions can be grounded in the
     * real tool data of this turn, and returns the JSON for the model.
     */
    private String respond(ToolContext context, String toolName, Object payload) throws Exception {
        String json = objectMapper.writeValueAsString(payload);
        String conversationId = getConversationId(context);
        if (conversationId != null) {
            followupContextStore.append(conversationId, toolName, json);
        }
        return json;
    }

    // ── 1. get_org_hierarchy ─────────────────────────────────────────────────

    @Tool(name = "get_org_hierarchy", description = "Get the complete organizational unit hierarchy tree and subtree details, including child counts and member counts.")
    public String getOrgHierarchy(GetOrgHierarchyRequest request, ToolContext context) {
        try {
            Map<String, Object> response = orgUnitStatisticService.getOrgHierarchy(getOrgUnitId(context));
            return respond(context, "get_org_hierarchy", response);
        } catch (Exception e) {
            log.error("Error in getOrgHierarchy", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 2. get_org_unit_detail ───────────────────────────────────────────────

    @Tool(name = "get_org_unit_detail", description = "View detailed information of a specific organizational unit.")
    public String getOrgUnitDetail(GetOrgUnitDetailRequest request, ToolContext context) {
        try {
            UUID targetId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getOrgUnitDetail(targetId);
            return respond(context, "get_org_unit_detail", response);
        } catch (Exception e) {
            log.error("Error in getOrgUnitDetail", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 3. get_child_org_units ───────────────────────────────────────────────

    @Tool(name = "get_child_org_units", description = "List and count child organizational units of a specified parent unit, with optional recursive subtree search.")
    public String getChildOrgUnits(GetChildOrgUnitsRequest request, ToolContext context) {
        try {
            UUID parentId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getChildOrgUnits(
                    parentId, request.recursive(), request.page(), request.size(),
                    request.sortBy(), request.sortDirection());
            return respond(context, "get_child_org_units", response);
        } catch (Exception e) {
            log.error("Error in getChildOrgUnits", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 4. get_members ───────────────────────────────────────────────────────

    @Tool(name = "get_members", description = "List and count members/users inside an organizational unit, supporting subtree searches and position/role filtering.")
    public String getMembers(GetMembersRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getMembers(
                    targetUnitId, request.includeChildUnits(), request.positionId(),
                    request.page(), request.size(), request.sortBy(), request.sortDirection());
            return respond(context, "get_members", response);
        } catch (Exception e) {
            log.error("Error in getMembers", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 5. get_org_unit_statistics ───────────────────────────────────────────

    @Tool(name = "get_org_unit_statistics", description = "Get aggregated KPI performance statistics (progress, performance, ratings, count of KPIs) for a group of members.")
    public String getOrgUnitStatistics(GetOrgUnitStatisticsRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getMemberStatistics(
                    targetUnitId, request.includeChildUnits(),
                    request.startDate(), request.endDate());
            return respond(context, "get_org_unit_statistics", response);
        } catch (Exception e) {
            log.error("Error in getOrgUnitStatistics", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 6. get_user_summary ──────────────────────────────────────────────────

    @Tool(name = "get_user_summary", description = "Get standard KPI statistics and list details of KPIs assigned to a specific user.")
    public String getUserSummary(GetUserSummaryRequest request, ToolContext context) {
        try {
            UUID targetUserId = UUID.fromString(request.userId());
            guardDisambiguation("user", targetUserId, "người dùng");
            validateUserAccess(targetUserId, context);
            Map<String, Object> response = orgUnitStatisticService.getUserSummary(
                    targetUserId, request.startDate(), request.endDate());
            return respond(context, "get_user_summary", response);
        } catch (Exception e) {
            log.error("Error in getUserSummary", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 7. get_kpis ──────────────────────────────────────────────────────────

    @Tool(name = "get_kpis", description = "List and filter KPI criteria with detailed query parameters and standard pagination/sorting.")
    public String getKpis(GetKpisRequest request, ToolContext context) {
        try {
            if (request.ownerId() != null && !request.ownerId().isBlank())
                validateUserAccess(UUID.fromString(request.ownerId()), context);
            if (request.assignedById() != null && !request.assignedById().isBlank())
                validateUserAccess(UUID.fromString(request.assignedById()), context);
            if (request.assignedToId() != null && !request.assignedToId().isBlank())
                validateUserAccess(UUID.fromString(request.assignedToId()), context);
            UUID orgUnitId = getOrgUnitId(context);
            Map<String, Object> response = orgUnitStatisticService.getKpis(
                    orgUnitId, request.ownerId(), request.assignedById(), request.assignedToId(),
                    request.periodId(), request.status(), request.page(), request.size(),
                    request.sortBy(), request.sortDirection(), request.startDate(), request.endDate());
            return respond(context, "get_kpis", response);
        } catch (Exception e) {
            log.error("Error in getKpis", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 8. get_kpi_summary ───────────────────────────────────────────────────

    @Tool(name = "get_kpi_summary", description = "Get aggregate statistics of KPIs matching the specified filter criteria.")
    public String getKpiSummary(GetKpiSummaryRequest request, ToolContext context) {
        try {
            if (request.ownerId() != null && !request.ownerId().isBlank())
                validateUserAccess(UUID.fromString(request.ownerId()), context);
            if (request.assignedById() != null && !request.assignedById().isBlank())
                validateUserAccess(UUID.fromString(request.assignedById()), context);
            if (request.assignedToId() != null && !request.assignedToId().isBlank())
                validateUserAccess(UUID.fromString(request.assignedToId()), context);
            UUID orgUnitId = getOrgUnitId(context);
            Map<String, Object> response = orgUnitStatisticService.getKpiSummary(
                    orgUnitId, request.ownerId(), request.assignedById(), request.assignedToId(),
                    request.periodId(), request.status(), request.startDate(), request.endDate());
            return respond(context, "get_kpi_summary", response);
        } catch (Exception e) {
            log.error("Error in getKpiSummary", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 9. get_kpi_detail ────────────────────────────────────────────────────

    @Tool(name = "get_kpi_detail", description = "Get complete detail about a specific KPI, showing progress, performance, rating, deadline, assigner, assignees, and status.")
    public String getKpiDetail(GetKpiDetailRequest request, ToolContext context) {
        try {
            UUID id = UUID.fromString(request.kpiId());
            guardDisambiguation("kpi", id, "KPI");
            validateKpiAccess(id, context);
            Map<String, Object> response = orgUnitStatisticService.getKpiDetail(
                    id, request.startDate(), request.endDate());
            return respond(context, "get_kpi_detail", response);
        } catch (Exception e) {
            log.error("Error in getKpiDetail", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 10. get_kpi_assignees ────────────────────────────────────────────────

    @Tool(name = "get_kpi_assignees", description = "Count and list all assignees of a specific KPI along with their parent organizational units.")
    public String getKpiAssignees(GetKpiAssigneesRequest request, ToolContext context) {
        try {
            UUID id = UUID.fromString(request.kpiId());
            guardDisambiguation("kpi", id, "KPI");
            validateKpiAccess(id, context);
            Map<String, Object> response = orgUnitStatisticService.getKpiAssignees(id);
            return respond(context, "get_kpi_assignees", response);
        } catch (Exception e) {
            log.error("Error in getKpiAssignees", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 11. get_kpi_periods ──────────────────────────────────────────────────

    @Tool(name = "get_kpi_periods", description = "List and detail KPI periods, including participants count, KPIs count, average progress, and performance.")
    public String getKpiPeriods(GetKpiPeriodsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.getKpiPeriods(
                    orgId, request.startDate(), request.endDate());
            return respond(context, "get_kpi_periods", response);
        } catch (Exception e) {
            log.error("Error in getKpiPeriods", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 12. get_positions ────────────────────────────────────────────────────

    @Tool(name = "get_positions", description = "Count and list roles/positions inside a unit along with the member count for each.")
    public String getPositions(GetPositionsRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getPositions(targetUnitId);
            return respond(context, "get_positions", response);
        } catch (Exception e) {
            log.error("Error in getPositions", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 13. rank_members ─────────────────────────────────────────────────────

    @Tool(name = "rank_members", description = "Ranks users by a chosen metric and returns a list with rank, userId, fullName, email, score. Metrics: 'average_progress' (weighted avg % of target reached), 'total_progress' (sum of approved actual values), 'average_performance' (weighted avg % against time-proportional target), 'average_rating' (evaluation score avg), 'late_submission_count', 'missing_submission_count', 'submission_count'. Scopes: 'organization' (all org users), 'unit' (requires unitId), 'kpi' (requires kpiId — ranks that KPI's assignees).")
    public String rankMembers(RankMembersRequest request, ToolContext context) {
        try {
            if ("unit".equals(request.scope()) && request.unitId() != null && !request.unitId().isBlank()) {
                validateSubtreeAccess(UUID.fromString(request.unitId()), context);
            }
            if ("kpi".equals(request.scope()) && request.kpiId() != null && !request.kpiId().isBlank()) {
                validateKpiAccess(UUID.fromString(request.kpiId()), context);
            }
            UUID orgId = getOrgId(context);
            UUID contextUnitId = getOrgUnitId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.rankMembers(
                    orgId, request.metric(), request.order(), request.scope(),
                    request.unitId(), request.kpiId(), request.limit(),
                    request.startDate(), request.endDate(), contextUnitId);
            return respond(context, "rank_members", response);
        } catch (Exception e) {
            log.error("Error in rankMembers", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 14. rank_org_units ───────────────────────────────────────────────────

    @Tool(name = "rank_org_units", description = "Ranks all organizational units in the current subtree by a metric and returns list with rank, orgUnitId, orgUnitName, score. Metrics: 'average_progress' (weighted avg % of target reached across the unit's KPIs), 'average_performance' (weighted avg % against time-proportional target), 'average_rating' (avg evaluation score), 'member_count'.")
    public String rankOrgUnits(RankOrgUnitsRequest request, ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.rankOrgUnits(
                    orgUnitId, request.metric(), request.order(), request.limit(),
                    request.startDate(), request.endDate());
            return respond(context, "rank_org_units", response);
        } catch (Exception e) {
            log.error("Error in rankOrgUnits", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 15. get_kpi_risk_analysis ────────────────────────────────────────────

    @Tool(name = "get_kpi_risk_analysis", description = "Analyze and identify at-risk, overdue, or stagnant KPIs within the current organizational unit's subtree.")
    public String getKpiRiskAnalysis(GetKpiRiskAnalysisRequest request, ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.getKpiRiskAnalysis(
                    orgUnitId, request.startDate(), request.endDate());
            return respond(context, "get_kpi_risk_analysis", response);
        } catch (Exception e) {
            log.error("Error in getKpiRiskAnalysis", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 16. get_dashboard_summary ────────────────────────────────────────────

    @Tool(name = "get_dashboard_summary", description = "Get high-level KPI dashboard overview metrics for the current organizational unit subtree.")
    public String getDashboardSummary(GetDashboardSummaryRequest request, ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            UUID orgId = getOrgId(context);
            Map<String, Object> response = orgUnitStatisticService.getDashboardSummary(
                    orgUnitId, orgId, request.startDate(), request.endDate());
            return respond(context, "get_dashboard_summary", response);
        } catch (Exception e) {
            log.error("Error in getDashboardSummary", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── get_time_series ──────────────────────────────────────────────────────

    @Tool(name = "get_time_series", description = "Get the trend of a KPI metric over time for an organizational unit subtree, plus detected anomaly points. Use this for questions about trends/evolution over months/quarters/years (e.g. 'xu hướng hiệu suất 6 tháng qua'). Metrics: 'completion' (sum actual / sum target %), 'avg_performance' (avg actual/target %). Granularity: 'MONTH' (default), 'QUARTER', 'YEAR'. 'lookback' keeps only the most recent N periods (default 6). Returns { metric, granularity, series:[{period,value}], anomalyPoints:[{period,value,deltaPct,type}] } where type is SPIKE (>+20%) or DROP (<-15%).")
    public String getTimeSeries(GetTimeSeriesRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getTimeSeries(
                    targetUnitId, request.metric(), request.granularity(), request.lookback());
            return respond(context, "get_time_series", response);
        } catch (Exception e) {
            log.error("Error in getTimeSeries", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 17. search_users ─────────────────────────────────────────────────────

    @Tool(name = "search_users", description = "Search users/employees by name, email, phone number, position/role name, or organizational unit. Returns user IDs and basic info to support other tools.")
    public String searchUsers(SearchUsersRequest request, ToolContext context) {
        try {
            if (request.unitId() != null && !request.unitId().isBlank()) {
                validateSubtreeAccess(UUID.fromString(request.unitId()), context);
            }
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> users = orgUnitStatisticService.searchUsers(
                    orgId, request.keyword(), request.unitId(), request.positionName(), maxResults);

            List<Map<String, Object>> dup = findDuplicateNameGroup(users, "fullName");
            if (!dup.isEmpty()
                    && !alreadyAskedPriorTurn(getConversationId(context), collisionName(dup, "fullName"), dup, "email", "orgUnitName", "roleName")) {
                disambiguationGuard.arm("user", collectIds(dup));
                return ambiguousEnvelope("người dùng", "users", users);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", users.size());
            result.put("users", users);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in searchUsers", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 18. search_org_units ─────────────────────────────────────────────────

    @Tool(name = "search_org_units", description = "Search organizational units by name. Returns unit IDs and basic info to support other tools.")
    public String searchOrgUnits(SearchOrgUnitsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> units = orgUnitStatisticService.searchOrgUnits(
                    orgId, request.keyword(), maxResults);

            List<Map<String, Object>> dup = findDuplicateNameGroup(units, "name");
            if (!dup.isEmpty()
                    && !alreadyAskedPriorTurn(getConversationId(context), collisionName(dup, "name"), dup, "code", "parentName", "levelName")) {
                disambiguationGuard.arm("orgUnit", collectIds(dup));
                return ambiguousEnvelope("đơn vị", "orgUnits", units);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", units.size());
            result.put("orgUnits", units);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in searchOrgUnits", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 19. search_kpis ──────────────────────────────────────────────────────

    @Tool(name = "search_kpis", description = "Search KPI criteria by name. Returns KPI IDs and basic info to support other tools.")
    public String searchKpis(SearchKpisRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> kpis = orgUnitStatisticService.searchKpis(
                    orgId, request.keyword(), maxResults);

            List<Map<String, Object>> dup = findDuplicateNameGroup(kpis, "name");
            if (!dup.isEmpty()
                    && !alreadyAskedPriorTurn(getConversationId(context), collisionName(dup, "name"), dup, "orgUnitName", "periodName")) {
                disambiguationGuard.arm("kpi", collectIds(dup));
                return ambiguousEnvelope("KPI", "kpis", kpis);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", kpis.size());
            result.put("kpis", kpis);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in searchKpis", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 20. search_positions ─────────────────────────────────────────────────

    @Tool(name = "search_positions", description = "Search roles/positions by name. Returns position IDs and basic info to support other tools.")
    public String searchPositions(SearchPositionsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> positions = orgUnitStatisticService.searchPositions(
                    orgId, request.keyword(), maxResults);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", positions.size());
            result.put("positions", positions);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in searchPositions", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    // ── 21. search_kpi_periods ───────────────────────────────────────────────

    @Tool(name = "search_kpi_periods", description = "Search KPI periods by name. Returns period IDs and basic info to support other tools.")
    public String searchKpiPeriods(SearchKpiPeriodsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> periods = orgUnitStatisticService.searchKpiPeriods(
                    orgId, request.keyword(), maxResults);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", periods.size());
            result.put("periods", periods);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Error in searchKpiPeriods", e);
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
