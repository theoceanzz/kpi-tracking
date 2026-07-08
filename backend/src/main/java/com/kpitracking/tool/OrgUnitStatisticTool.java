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

    /**
     * Parses a model-supplied ID into a UUID. On a malformed value (e.g. the model
     * invented a human-readable code like "IT-DEPT"), throws a recoverable, model-readable
     * instruction telling it which {@code search_*} tool to use to obtain the real UUID,
     * so it can self-correct within the same turn instead of failing cryptically.
     */
    private UUID parseId(String value, String paramLabel, String searchTool) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "'" + value + "' không phải là ID hợp lệ cho " + paramLabel
                    + ". Hãy dùng công cụ " + searchTool + " để lấy đúng ID (UUID) trước, rồi gọi lại.");
        }
    }

    /**
     * Centralizes tool error handling: recoverable model-input mistakes are logged at WARN
     * (one line, no stack trace) since they are returned to the model to self-correct;
     * genuine faults keep a full ERROR stack trace. Always returns properly-escaped JSON.
     */
    private String toolError(String tool, Exception e) {
        if (e instanceof IllegalArgumentException || e instanceof SecurityException
                || e instanceof IllegalStateException) {
            log.warn("Recoverable error in {}: {}", tool, e.getMessage());
        } else {
            log.error("Error in {}", tool, e);
        }
        try {
            return objectMapper.writeValueAsString(
                    Map.of("error", e.getMessage() != null ? e.getMessage() : e.toString()));
        } catch (Exception ignore) {
            return "{\"error\":\"Lỗi xử lý yêu cầu.\"}";
        }
    }

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

    private String getUserEmail(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object email = context.getContext().get("userEmail");
        return email != null ? email.toString() : null;
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
            UUID targetId = parseId(unitId, "đơn vị (unitId)", "search_org_units");
            guardDisambiguation("orgUnit", targetId, "đơn vị");
            validateSubtreeAccess(targetId, context);
            return targetId;
        }
        return getOrgUnitId(context);
    }

    /** Kết quả resolve đơn vị theo id/tên: hoặc ra 1 UUID, hoặc cần hỏi làm rõ (needsClarification). */
    private record UnitRef(UUID id, Map<String, Object> clarification) {}

    /**
     * Tìm đơn vị theo tên trong tổ chức, ƯU TIÊN khớp CHÍNH XÁC tên (vd có phòng cha "Sales")
     * để tránh mơ hồ giả; nếu không có khớp chính xác thì trả toàn bộ kết quả khớp gần đúng.
     */
    private List<Map<String, Object>> unitMatchPool(String name, UUID orgId) {
        List<Map<String, Object>> matches = orgUnitStatisticService.searchOrgUnits(orgId, name.trim(), 10);
        List<Map<String, Object>> exact = matches.stream()
                .filter(m -> name.trim().equalsIgnoreCase(String.valueOf(m.get("name"))))
                .collect(java.util.stream.Collectors.toList());
        return !exact.isEmpty() ? exact : matches;
    }

    /** Envelope yêu cầu làm rõ khi 1 tên đơn vị khớp nhiều/không thấy (cho các tool 1 đơn vị). */
    private Map<String, Object> unitClarification(String query, List<Map<String, Object>> pool, ToolContext context) {
        String convId = getConversationId(context);
        if (convId != null) followupContextStore.markDisambiguating(convId);
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("query", query);
        group.put("reason", pool.isEmpty() ? "not_found" : "ambiguous");
        group.put("options", pool);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("needsClarification", true);
        out.put("ambiguous", java.util.List.of(group));
        out.put("message", "Tên đơn vị '" + query + "' khớp NHIỀU đơn vị (hoặc không tìm thấy). Hãy hỏi người dùng "
                + "chọn RÕ đơn vị (nêu đơn vị cha/cấp để phân biệt) rồi gọi lại với tên cụ thể.");
        return out;
    }

    /**
     * Resolve đơn vị đích cho các tool 1 đơn vị: ưu tiên unitId (UUID), rồi unitName (tự resolve,
     * có thể cần hỏi làm rõ), cuối cùng mặc định là đơn vị hiện tại của người dùng.
     */
    private UnitRef resolveUnit(String unitId, String unitName, ToolContext context) {
        if (unitId != null && !unitId.isBlank()) {
            UUID id = parseId(unitId, "đơn vị (unitId)", "search_org_units");
            guardDisambiguation("orgUnit", id, "đơn vị");
            validateSubtreeAccess(id, context);
            return new UnitRef(id, null);
        }
        if (unitName != null && !unitName.isBlank()) {
            List<Map<String, Object>> pool = unitMatchPool(unitName, getOrgId(context));
            if (pool.size() == 1) {
                UUID id = UUID.fromString(String.valueOf(pool.get(0).get("id")));
                validateSubtreeAccess(id, context);
                return new UnitRef(id, null);
            }
            return new UnitRef(null, unitClarification(unitName.trim(), pool, context));
        }
        return new UnitRef(getOrgUnitId(context), null);
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
     * Mark the conversation as disambiguating, then return the ambiguous envelope.
     * Suppresses follow-up question generation until user makes a selection.
     */
    private String returnAmbiguous(String entityLabel, String arrayKey,
                                   List<Map<String, Object>> results, ToolContext context) throws Exception {
        String convId = getConversationId(context);
        if (convId != null) {
            followupContextStore.markDisambiguating(convId);
        }
        return ambiguousEnvelope(entityLabel, arrayKey, results);
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
            return toolError("getOrgHierarchy", e);
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
            return toolError("getOrgUnitDetail", e);
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
            return toolError("getChildOrgUnits", e);
        }
    }

    // ── 4. get_members ───────────────────────────────────────────────────────

    @Tool(name = "get_members", description = "List and count members/users inside an organizational unit, supporting subtree searches and position/role filtering. To filter by position, PREFER positionName (e.g. 'trưởng phòng') — resolved in-tool, no need to search_positions first; positionId (UUID) also accepted.")
    public String getMembers(GetMembersRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            if (request.positionId() != null && !request.positionId().isBlank())
                parseId(request.positionId(), "vị trí (positionId)", "search_positions");
            Map<String, Object> response = orgUnitStatisticService.getMembers(
                    targetUnitId, request.includeChildUnits(), request.positionId(), request.positionName(),
                    request.page(), request.size(), request.sortBy(), request.sortDirection());
            return respond(context, "get_members", response);
        } catch (Exception e) {
            return toolError("getMembers", e);
        }
    }

    // ── 5. get_org_unit_statistics ───────────────────────────────────────────

    @Tool(name = "get_org_unit_statistics", description = "Get aggregated KPI performance statistics (progress, performance, ratings, count of KPIs) for a group of members. Optional positionName (e.g. 'trưởng phòng') restricts the group to members holding that position — resolved in-tool, no search_positions needed.")
    public String getOrgUnitStatistics(GetOrgUnitStatisticsRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getMemberStatistics(
                    targetUnitId, request.includeChildUnits(), request.positionName(),
                    request.startDate(), request.endDate());
            return respond(context, "get_org_unit_statistics", response);
        } catch (Exception e) {
            return toolError("getOrgUnitStatistics", e);
        }
    }

    // ── 6. get_user_summary ──────────────────────────────────────────────────

    @Tool(name = "get_user_summary", description = "Get standard KPI statistics and list details of KPIs assigned to a specific user.")
    public String getUserSummary(GetUserSummaryRequest request, ToolContext context) {
        try {
            UUID targetUserId = parseId(request.userId(), "người dùng (userId)", "search_users");
            guardDisambiguation("user", targetUserId, "người dùng");
            validateUserAccess(targetUserId, context);
            Map<String, Object> response = orgUnitStatisticService.getUserSummary(
                    targetUserId, request.startDate(), request.endDate());
            return respond(context, "get_user_summary", response);
        } catch (Exception e) {
            return toolError("getUserSummary", e);
        }
    }

    // ── 6b. get_my_info ──────────────────────────────────────────────────────

    @Tool(name = "get_my_info", description = "Current logged-in user's own profile: full name, contact, org unit(s), position/role, organization. Use for self-referential questions ('tôi là ai', 'đơn vị của tôi', 'chức vụ của tôi', 'tôi thuộc tổ chức nào').")
    public String getMyInfo(GetMyInfoRequest request, ToolContext context) {
        try {
            String email = getUserEmail(context);
            if (email == null || email.isBlank()) {
                throw new IllegalStateException("Không xác định được người dùng hiện tại.");
            }
            Map<String, Object> response = orgUnitStatisticService.getCurrentUserProfile(email);
            return respond(context, "get_my_info", response);
        } catch (Exception e) {
            return toolError("getMyInfo", e);
        }
    }

    // ── 7. get_kpis ──────────────────────────────────────────────────────────

    @Tool(name = "get_kpis", description = "List/filter KPI criteria (pagination/sorting). Each KPI: name, periodName, progress (% of target reached) — use to compare KPI health. Defaults to your CURRENT unit; pass unitName (e.g. 'phòng IT') to target another unit's subtree. Returns NO IDs; resolve a KPI's UUID via search_kpis before get_kpi_detail/get_submission_history.")
    public String getKpis(GetKpisRequest request, ToolContext context) {
        try {
            if (request.ownerId() != null && !request.ownerId().isBlank())
                validateUserAccess(parseId(request.ownerId(), "người dùng (ownerId)", "search_users"), context);
            if (request.assignedById() != null && !request.assignedById().isBlank())
                validateUserAccess(parseId(request.assignedById(), "người dùng (assignedById)", "search_users"), context);
            if (request.assignedToId() != null && !request.assignedToId().isBlank())
                validateUserAccess(parseId(request.assignedToId(), "người dùng (assignedToId)", "search_users"), context);
            if (request.periodId() != null && !request.periodId().isBlank())
                parseId(request.periodId(), "kỳ KPI (periodId)", "search_kpi_periods");
            UnitRef u = resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return respond(context, "get_kpis", u.clarification());
            UUID orgUnitId = u.id();
            Map<String, Object> response = orgUnitStatisticService.getKpis(
                    orgUnitId, request.ownerId(), request.assignedById(), request.assignedToId(),
                    request.periodId(), request.status(), request.page(), request.size(),
                    request.sortBy(), request.sortDirection(), request.startDate(), request.endDate());
            return respond(context, "get_kpis", response);
        } catch (Exception e) {
            return toolError("getKpis", e);
        }
    }

    // ── 8. get_kpi_summary ───────────────────────────────────────────────────

    @Tool(name = "get_kpi_summary", description = "Get aggregate statistics of KPIs matching the specified filter criteria. Defaults to your CURRENT unit; pass unitName (e.g. 'phòng IT') to target another unit's subtree.")
    public String getKpiSummary(GetKpiSummaryRequest request, ToolContext context) {
        try {
            if (request.ownerId() != null && !request.ownerId().isBlank())
                validateUserAccess(parseId(request.ownerId(), "người dùng (ownerId)", "search_users"), context);
            if (request.assignedById() != null && !request.assignedById().isBlank())
                validateUserAccess(parseId(request.assignedById(), "người dùng (assignedById)", "search_users"), context);
            if (request.assignedToId() != null && !request.assignedToId().isBlank())
                validateUserAccess(parseId(request.assignedToId(), "người dùng (assignedToId)", "search_users"), context);
            if (request.periodId() != null && !request.periodId().isBlank())
                parseId(request.periodId(), "kỳ KPI (periodId)", "search_kpi_periods");
            UnitRef u = resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return respond(context, "get_kpi_summary", u.clarification());
            UUID orgUnitId = u.id();
            Map<String, Object> response = orgUnitStatisticService.getKpiSummary(
                    orgUnitId, request.ownerId(), request.assignedById(), request.assignedToId(),
                    request.periodId(), request.status(), request.startDate(), request.endDate());
            return respond(context, "get_kpi_summary", response);
        } catch (Exception e) {
            return toolError("getKpiSummary", e);
        }
    }

    // ── 9. get_kpi_detail ────────────────────────────────────────────────────

    @Tool(name = "get_kpi_detail", description = "Get complete detail about a specific KPI, showing progress, performance, rating, deadline, assigner, assignees, and status.")
    public String getKpiDetail(GetKpiDetailRequest request, ToolContext context) {
        try {
            UUID id = parseId(request.kpiId(), "KPI (kpiId)", "search_kpis");
            guardDisambiguation("kpi", id, "KPI");
            validateKpiAccess(id, context);
            Map<String, Object> response = orgUnitStatisticService.getKpiDetail(
                    id, request.startDate(), request.endDate());
            return respond(context, "get_kpi_detail", response);
        } catch (Exception e) {
            return toolError("getKpiDetail", e);
        }
    }

    // ── 10. get_kpi_assignees ────────────────────────────────────────────────

    @Tool(name = "get_kpi_assignees", description = "Count and list all assignees of a specific KPI along with their parent organizational units.")
    public String getKpiAssignees(GetKpiAssigneesRequest request, ToolContext context) {
        try {
            UUID id = parseId(request.kpiId(), "KPI (kpiId)", "search_kpis");
            guardDisambiguation("kpi", id, "KPI");
            validateKpiAccess(id, context);
            Map<String, Object> response = orgUnitStatisticService.getKpiAssignees(id);
            return respond(context, "get_kpi_assignees", response);
        } catch (Exception e) {
            return toolError("getKpiAssignees", e);
        }
    }

    // ── 11. get_kpi_periods ──────────────────────────────────────────────────

    @Tool(name = "get_kpi_periods", description = "List and detail KPI periods (participants count, KPIs count, average progress/performance). Defaults to ALL periods of the organization; pass unitName (e.g. 'phòng IT') to list ONLY periods that unit PARTICIPATES in, with counts scoped to that unit.")
    public String getKpiPeriods(GetKpiPeriodsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            // Chỉ resolve khi người dùng nêu đơn vị; không nêu -> giữ phạm vi toàn tổ chức (như cũ).
            UUID targetUnitId = null;
            boolean hasUnit = (request.unitId() != null && !request.unitId().isBlank())
                    || (request.unitName() != null && !request.unitName().isBlank());
            if (hasUnit) {
                UnitRef u = resolveUnit(request.unitId(), request.unitName(), context);
                if (u.clarification() != null) return respond(context, "get_kpi_periods", u.clarification());
                targetUnitId = u.id();
            }
            List<Map<String, Object>> response = orgUnitStatisticService.getKpiPeriods(
                    orgId, targetUnitId, request.startDate(), request.endDate());
            return respond(context, "get_kpi_periods", response);
        } catch (Exception e) {
            return toolError("getKpiPeriods", e);
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
            return toolError("getPositions", e);
        }
    }

    // ── 13. rank_members ─────────────────────────────────────────────────────

    @Tool(name = "rank_members", description = "Rank users by metric → [rank, fullName, email, score] (no IDs; use search_users for UUID). Metrics: average_progress (weighted avg % of target reached), total_progress (sum of approved actuals), average_performance (weighted avg % vs time-proportional target), average_rating, late_submission_count, missing_submission_count, submission_count. Scopes: organization (all org users) | unit (needs unitId) | kpi (needs kpiId — ranks that KPI's assignees). FILTERS (apply on top of scope, avoid chaining): managersOnly=true keeps only unit heads/managers; positionFilter=<role name> keeps only users holding a matching position (e.g. 'trưởng phòng', 'phó phòng'). Use these to answer 'so sánh/xếp hạng <chức vụ> theo điểm đánh giá' in ONE call, e.g. rank all department heads by average_rating ascending to find the lowest.")
    public String rankMembers(RankMembersRequest request, ToolContext context) {
        try {
            if ("unit".equals(request.scope()) && request.unitId() != null && !request.unitId().isBlank()) {
                validateSubtreeAccess(parseId(request.unitId(), "đơn vị (unitId)", "search_org_units"), context);
            }
            if ("kpi".equals(request.scope()) && request.kpiId() != null && !request.kpiId().isBlank()) {
                validateKpiAccess(parseId(request.kpiId(), "KPI (kpiId)", "search_kpis"), context);
            }
            UUID orgId = getOrgId(context);
            UUID contextUnitId = getOrgUnitId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.rankMembers(
                    orgId, request.metric(), request.order(), request.scope(),
                    request.unitId(), request.kpiId(), request.limit(),
                    request.startDate(), request.endDate(), contextUnitId,
                    request.positionFilter(), request.managersOnly());
            return respond(context, "rank_members", response);
        } catch (Exception e) {
            return toolError("rankMembers", e);
        }
    }

    // ── 14. rank_org_units ───────────────────────────────────────────────────

    @Tool(name = "rank_org_units", description = "Rank org units in the current subtree by metric → [rank, orgUnitName, score] (no IDs; use search_org_units for UUID). Metrics: average_progress (weighted avg % of target reached across the unit's KPIs), average_performance (weighted avg % vs time-proportional target), average_rating, member_count.")
    public String rankOrgUnits(RankOrgUnitsRequest request, ToolContext context) {
        try {
            UUID orgUnitId = getOrgUnitId(context);
            List<Map<String, Object>> response = orgUnitStatisticService.rankOrgUnits(
                    orgUnitId, request.metric(), request.order(), request.limit(),
                    request.startDate(), request.endDate());
            return respond(context, "rank_org_units", response);
        } catch (Exception e) {
            return toolError("rankOrgUnits", e);
        }
    }

    // ── 15. get_kpi_risk_analysis ────────────────────────────────────────────

    @Tool(name = "get_kpi_risk_analysis", description = "Analyze and identify at-risk, overdue, or stagnant KPIs within a unit's subtree. Defaults to your CURRENT unit; pass unitName (e.g. 'phòng vận hành') to target another unit.")
    public String getKpiRiskAnalysis(GetKpiRiskAnalysisRequest request, ToolContext context) {
        try {
            UnitRef u = resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return respond(context, "get_kpi_risk_analysis", u.clarification());
            List<Map<String, Object>> response = orgUnitStatisticService.getKpiRiskAnalysis(
                    u.id(), request.startDate(), request.endDate());
            return respond(context, "get_kpi_risk_analysis", response);
        } catch (Exception e) {
            return toolError("getKpiRiskAnalysis", e);
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
            return toolError("getDashboardSummary", e);
        }
    }

    // ── get_time_series ──────────────────────────────────────────────────────

    @Tool(name = "get_time_series", description = "Trend of a KPI metric over time for an org unit subtree + anomaly points. Use for trends/evolution over months/quarters/years (e.g. 'xu hướng hiệu suất 6 tháng qua'). Metrics: completion (sum actual / sum target %), avg_performance (avg actual/target %). Granularity: MONTH (default) | QUARTER | YEAR. lookback = most recent N periods (default 6). Returns { metric, granularity, series:[{period,value}], anomalyPoints:[{period,value,deltaPct,type}] }; type = SPIKE (>+20%) or DROP (<-15%).")
    public String getTimeSeries(GetTimeSeriesRequest request, ToolContext context) {
        try {
            UUID targetUnitId = resolveUnitId(request.unitId(), context);
            Map<String, Object> response = orgUnitStatisticService.getTimeSeries(
                    targetUnitId, request.metric(), request.granularity(), request.lookback());
            return respond(context, "get_time_series", response);
        } catch (Exception e) {
            return toolError("getTimeSeries", e);
        }
    }

    // ── get_submission_history ────────────────────────────────────────────────

    @Tool(name = "get_submission_history", description = "List individual submissions for a KPI (timeline/trace). Filters: userId (one assignee), status (PENDING|APPROVED|REJECTED|DRAFT), date range, limit. Returns submissions sorted by createdAt: submittedBy, actualValue, status, reviewedBy, reviewNote.")
    public String getSubmissionHistory(OrgUnitStatisticToolRequests.GetSubmissionHistoryRequest request, ToolContext context) {
        try {
            UUID kpiId = parseId(request.kpiId(), "KPI (kpiId)", "search_kpis");
            guardDisambiguation("kpi", kpiId, "KPI");
            validateKpiAccess(kpiId, context);
            if (request.userId() != null && !request.userId().isBlank())
                parseId(request.userId(), "người dùng (userId)", "search_users");
            Map<String, Object> response = orgUnitStatisticService.getSubmissionHistory(
                    kpiId, request.userId(), request.status(),
                    request.startDate(), request.endDate(),
                    request.limit() != null ? request.limit() : 20);
            return respond(context, "get_submission_history", response);
        } catch (Exception e) {
            return toolError("getSubmissionHistory", e);
        }
    }

    // ── get_kpi_period_breakdown ──────────────────────────────────────────────

    @Tool(name = "get_kpi_period_breakdown", description = "Per-period performance breakdown for a single KPI (trend by month/quarter/year). Use for KPI evolution: 'how did KPI X evolve', 'progression over time'. Returns [{periodLabel, totalActual, target, completionPct, submissionCount}] with trend direction (improving|declining|stable).")
    public String getKpiPeriodBreakdown(OrgUnitStatisticToolRequests.GetKpiPeriodBreakdownRequest request, ToolContext context) {
        try {
            UUID kpiId = parseId(request.kpiId(), "KPI (kpiId)", "search_kpis");
            guardDisambiguation("kpi", kpiId, "KPI");
            validateKpiAccess(kpiId, context);
            if (request.userId() != null && !request.userId().isBlank())
                parseId(request.userId(), "người dùng (userId)", "search_users");
            Map<String, Object> response = orgUnitStatisticService.getKpiPeriodBreakdown(
                    kpiId, request.userId(), request.granularity(),
                    request.startDate(), request.endDate());
            return respond(context, "get_kpi_period_breakdown", response);
        } catch (Exception e) {
            return toolError("getKpiPeriodBreakdown", e);
        }
    }

    // ── get_non_submitters ────────────────────────────────────────────────────

    @Tool(name = "get_non_submitters", description = "Assignees with KPIs but who have NOT submitted within the period/date range. Use for accountability: 'who hasn\\'t submitted', 'who is late'. Returns fullName, email, missingKpiCount sorted by missing count desc (no IDs; use search_users for UUID).")
    public String getNonSubmitters(OrgUnitStatisticToolRequests.GetNonSubmittersRequest request, ToolContext context) {
        try {
            UUID contextUnitId = getOrgUnitId(context);
            UUID targetUnitId = (request.unitId() != null && !request.unitId().isBlank())
                    ? parseId(request.unitId(), "đơn vị (unitId)", "search_org_units")
                    : contextUnitId;
            validateSubtreeAccess(targetUnitId, context);
            if (request.periodId() != null && !request.periodId().isBlank())
                parseId(request.periodId(), "kỳ KPI (periodId)", "search_kpi_periods");
            Map<String, Object> response = orgUnitStatisticService.getNonSubmitters(
                    targetUnitId, request.periodId(),
                    request.startDate(), request.endDate(),
                    request.limit() != null ? request.limit() : 20);
            return respond(context, "get_non_submitters", response);
        } catch (Exception e) {
            return toolError("getNonSubmitters", e);
        }
    }

    // ── compare_org_units ─────────────────────────────────────────────────────

    @Tool(name = "compare_org_units", description = "Compare 2–5 org units side by side on KPI metrics (avgPerformance, avgProgress, memberCount, completionRate). Use for cross-unit comparison: 'so sánh đơn vị A vs B'. PREFER passing unitNames — the tool resolves them by name in ONE call, so you do NOT need to search_org_units first; unitIds (UUID) also accepted. If a name matches multiple units, the tool returns needsClarification listing ALL options for EVERY ambiguous name at once — ask the user to pick them ALL in ONE question, then call again with the specific names. Returns units list with winner (best performer) marked.")
    public String compareOrgUnits(OrgUnitStatisticToolRequests.CompareOrgUnitsRequest request, ToolContext context) {
        try {
            UUID orgId = getOrgId(context);
            java.util.List<UUID> unitIds = new java.util.ArrayList<>();

            // 1. UUID truyền thẳng (giữ tương thích).
            if (request.unitIds() != null) {
                for (String id : request.unitIds()) {
                    if (id != null && !id.isBlank()) unitIds.add(parseId(id, "đơn vị (unitIds)", "search_org_units"));
                }
            }

            // 2. Resolve theo TÊN ngay trong tool (bỏ bước search riêng). Gom MỌI tên mơ hồ/không thấy
            //    để hỏi người dùng một lần, thay vì search tuần tự từng đơn vị (mỗi cái một lượt hỏi).
            java.util.List<Map<String, Object>> clarify = new java.util.ArrayList<>();
            if (request.unitNames() != null) {
                for (String name : request.unitNames()) {
                    if (name == null || name.isBlank()) continue;
                    String q = name.trim();
                    List<Map<String, Object>> pool = unitMatchPool(q, orgId);
                    if (pool.size() == 1) {
                        unitIds.add(UUID.fromString(String.valueOf(pool.get(0).get("id"))));
                    } else {
                        Map<String, Object> group = new java.util.LinkedHashMap<>();
                        group.put("query", q);
                        group.put("reason", pool.isEmpty() ? "not_found" : "ambiguous");
                        group.put("options", pool);
                        clarify.add(group);
                    }
                }
            }

            // 3. Có tên chưa xác định duy nhất -> trả yêu cầu làm rõ GỘP (hỏi 1 lần cho tất cả).
            if (!clarify.isEmpty()) {
                String convId = getConversationId(context);
                if (convId != null) followupContextStore.markDisambiguating(convId);
                Map<String, Object> out = new java.util.LinkedHashMap<>();
                out.put("needsClarification", true);
                out.put("ambiguous", clarify);
                out.put("message", "Một số tên đơn vị khớp NHIỀU đơn vị (hoặc không tìm thấy). Hãy hỏi người dùng "
                        + "chọn RÕ từng đơn vị (liệt kê đủ lựa chọn kèm đơn vị cha/cấp để phân biệt) trong MỘT câu hỏi, "
                        + "rồi gọi lại compare_org_units với tên cụ thể đã chọn.");
                return respond(context, "compare_org_units", out);
            }

            // 4. Khử trùng, kiểm tra số lượng + phân quyền, rồi so sánh.
            java.util.List<UUID> distinct = unitIds.stream().distinct().collect(java.util.stream.Collectors.toList());
            if (distinct.size() < 2) {
                throw new IllegalArgumentException("Cần ít nhất 2 đơn vị KHÁC NHAU để so sánh. Hãy cung cấp unitNames (tên) hoặc unitIds.");
            }
            if (distinct.size() > 5) distinct = distinct.subList(0, 5);
            for (UUID uid : distinct) validateSubtreeAccess(uid, context);
            Map<String, Object> response = orgUnitStatisticService.compareOrgUnits(
                    distinct, request.startDate(), request.endDate());
            return respond(context, "compare_org_units", response);
        } catch (Exception e) {
            return toolError("compareOrgUnits", e);
        }
    }

    // ── get_members_by_performance_threshold ───────────────────────────────────

    @Tool(name = "get_members_by_performance_threshold", description = "Filter members by a performance threshold (e.g. 'below 80%', 'above 90%'). Use for action decisions: 'who needs intervention', 'who to coach', 'top performers'. Returns members past the threshold with scores, sorted by direction.")
    public String getMembersByPerformanceThreshold(OrgUnitStatisticToolRequests.GetMembersByPerformanceThresholdRequest request, ToolContext context) {
        try {
            UUID contextUnitId = getOrgUnitId(context);
            UUID targetUnitId = (request.unitId() != null && !request.unitId().isBlank())
                    ? parseId(request.unitId(), "đơn vị (unitId)", "search_org_units")
                    : contextUnitId;
            validateSubtreeAccess(targetUnitId, context);
            Map<String, Object> response = orgUnitStatisticService.getMembersByPerformanceThreshold(
                    targetUnitId, request.threshold() != null ? request.threshold() : 80.0,
                    request.direction(), request.metric(),
                    request.startDate(), request.endDate(),
                    request.limit() != null ? request.limit() : 20);
            return respond(context, "get_members_by_performance_threshold", response);
        } catch (Exception e) {
            return toolError("getMembersByPerformanceThreshold", e);
        }
    }

    // ── 17. search_users ─────────────────────────────────────────────────────

    @Tool(name = "search_users", description = "Search users/employees by name, email, phone number, position/role name, or organizational unit. Returns user IDs and basic info to support other tools.")
    public String searchUsers(SearchUsersRequest request, ToolContext context) {
        try {
            if (request.unitId() != null && !request.unitId().isBlank()) {
                validateSubtreeAccess(parseId(request.unitId(), "đơn vị (unitId)", "search_org_units"), context);
            }
            UUID orgId = getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;
            List<Map<String, Object>> users = orgUnitStatisticService.searchUsers(
                    orgId, request.keyword(), request.unitId(), request.positionName(), maxResults);

            List<Map<String, Object>> dup = findDuplicateNameGroup(users, "fullName");
            if (!dup.isEmpty()
                    && !alreadyAskedPriorTurn(getConversationId(context), collisionName(dup, "fullName"), dup, "email", "orgUnitName", "roleName")) {
                disambiguationGuard.arm("user", collectIds(dup));
                return returnAmbiguous("người dùng", "users", users, context);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", users.size());
            result.put("users", users);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            return toolError("searchUsers", e);
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
                return returnAmbiguous("đơn vị", "orgUnits", units, context);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", units.size());
            result.put("orgUnits", units);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            return toolError("searchOrgUnits", e);
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
                return returnAmbiguous("KPI", "kpis", kpis, context);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", kpis.size());
            result.put("kpis", kpis);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            return toolError("searchKpis", e);
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
            return toolError("searchPositions", e);
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
            return toolError("searchKpiPeriods", e);
        }
    }
}
