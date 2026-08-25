package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.kpitracking.service.ai.ToolProgress;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.*;
import com.kpitracking.service.ai.agent.AgentState;

/**
 * Phần dùng chung của mọi tool AI: đọc ngữ cảnh, kiểm phạm vi/quyền, resolve tên → ID, hỏi làm rõ
 * khi trùng tên, và đóng gói kết quả trả cho model.
 *
 * <p>Tách ra khỏi lớp tool để mỗi nhóm tool chỉ còn phần nghiệp vụ của nó, và để phần <b>quyết định
 * quyền truy cập</b> có một chỗ duy nhất kiểm thử được — trước đây nằm lẫn trong một lớp 1.064 dòng
 * nên không viết test được.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ToolSupport {

    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final OrgUnitStatisticService orgUnitStatisticService;
    private final FollowupContextStore followupContextStore;
    private final ObjectMapper objectMapper;

    /**
     * Mapper riêng cho JSON gửi cho MODEL: bỏ field null để khỏi tốn token cho các cặp
     * "key":null (payload tool dùng LinkedHashMap nên null xuất hiện khá nhiều). Dùng
     * objectMapper.copy() để giữ nguyên module/config đã đăng ký (JavaTimeModule...),
     * và KHÔNG đụng vào mapper dùng chung của REST API.
     */
    private ObjectMapper toolMapper;

    @jakarta.annotation.PostConstruct
    void initToolMapper() {
        // setSerializationInclusion(NON_NULL) đã đủ để bỏ null trong Map (đã kiểm chứng);
        // KHÔNG thêm configOverride(Map.class) với content=ALWAYS vì nó bật null trở lại.
        toolMapper = objectMapper.copy().setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    public ObjectMapper toolMapper() {
        return toolMapper;
    }

    public static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    // ── ID & lỗi ─────────────────────────────────────────────────────────────

    /**
     * Parses a model-supplied ID into a UUID. On a malformed value (e.g. the model
     * invented a human-readable code like "IT-DEPT"), throws a recoverable, model-readable
     * instruction telling it which search tool to use to obtain the real UUID,
     * so it can self-correct within the same turn instead of failing cryptically.
     */
    public UUID parseId(String value, String paramLabel, String searchTool) {
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
    public String toolError(String tool, Exception e) {
        if (e instanceof IllegalArgumentException || e instanceof SecurityException
                || e instanceof IllegalStateException) {
            log.warn("Recoverable error in {}: {}", tool, e.getMessage());
        } else {
            log.error("Error in {}", tool, e);
        }
        try {
            return toolMapper.writeValueAsString(
                    Map.of("error", e.getMessage() != null ? e.getMessage() : e.toString()));
        } catch (Exception ignore) {
            return "{\"error\":\"Lỗi xử lý yêu cầu.\"}";
        }
    }

    // ── ngữ cảnh ─────────────────────────────────────────────────────────────

    public UUID getOrgUnitId(ToolContext context) {
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

    public UUID getOrgId(ToolContext context) {
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

    public String getContextPath(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object path = context.getContext().get("orgUnitPath");
        return path != null ? path.toString() : null;
    }

    public String getUserEmail(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object email = context.getContext().get("userEmail");
        return email != null ? email.toString() : null;
    }

    public String getConversationId(ToolContext context) {
        if (context == null || context.getContext() == null) return null;
        Object id = context.getContext().get("conversationId");
        return id != null ? id.toString() : null;
    }

    // ── kiểm phạm vi truy cập ────────────────────────────────────────────────

    public void validateSubtreeAccess(UUID targetUnitId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return;
        OrgUnit target = orgUnitRepository.findById(targetUnitId)
                .orElseThrow(() -> new RuntimeException("Đơn vị không tồn tại: " + targetUnitId));
        if (!target.getPath().startsWith(contextPath)) {
            throw new SecurityException("Không có quyền truy cập đơn vị này. Bạn chỉ có thể truy cập đơn vị của mình và các đơn vị con.");
        }
    }

    public void validateUserAccess(UUID targetUserId, ToolContext context) {
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

    public void validateKpiAccess(UUID kpiId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return;
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new RuntimeException("KPI không tồn tại: " + kpiId));
        if (!kpi.getOrgUnit().getPath().startsWith(contextPath)) {
            throw new SecurityException("Không có quyền truy cập KPI này. KPI không thuộc phạm vi đơn vị của bạn.");
        }
    }

    /** Bản boolean của validateKpiAccess — để LỌC (không ném lỗi) khi gom nhiều KPI cùng tên. */
    public boolean hasKpiAccess(UUID kpiId, ToolContext context) {
        String contextPath = getContextPath(context);
        if (contextPath == null) return true;
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId).orElse(null);
        return kpi != null && kpi.getOrgUnit() != null && kpi.getOrgUnit().getPath() != null
                && kpi.getOrgUnit().getPath().startsWith(contextPath);
    }

    // ── resolve đơn vị / KPI theo tên ────────────────────────────────────────

    /** Kết quả resolve đơn vị theo id/tên: hoặc ra 1 UUID, hoặc cần hỏi làm rõ (needsClarification). */
    public record UnitRef(UUID id, Map<String, Object> clarification) {}

    /**
     * Tìm đơn vị theo tên trong tổ chức, ƯU TIÊN khớp CHÍNH XÁC tên (vd có phòng cha "Sales")
     * để tránh mơ hồ giả; nếu không có khớp chính xác thì trả toàn bộ kết quả khớp gần đúng.
     */
    public List<Map<String, Object>> unitMatchPool(String name, UUID orgId) {
        List<Map<String, Object>> matches = orgUnitStatisticService.searchOrgUnits(orgId, name.trim(), 10);
        List<Map<String, Object>> exact = matches.stream()
                .filter(m -> name.trim().equalsIgnoreCase(String.valueOf(m.get("name"))))
                .collect(java.util.stream.Collectors.toList());
        return !exact.isEmpty() ? exact : matches;
    }

    /** Kết quả resolve NGƯỜI theo id/tên: hoặc ra 1 UUID, hoặc cần hỏi làm rõ. */
    public record UserRef(UUID id, Map<String, Object> clarification) {}

    /**
     * Người trong tổ chức khớp TÊN, ưu tiên khớp CHÍNH XÁC.
     *
     * <p>Cùng luật với {@link #unitMatchPool}: có người tên đúng hệt thì chỉ lấy những người đó,
     * để "Vũ Thị" không bị coi là mơ hồ chỉ vì còn "Vũ Thị Deputy Lead" ở đâu đó. Giữ chung một luật
     * là có chủ đích — hai luật khớp tên song song sẽ trôi lệch rồi trả lời khác nhau cho cùng câu hỏi.
     */
    public List<Map<String, Object>> userMatchPool(String name, UUID orgId) {
        List<Map<String, Object>> matches =
                orgUnitStatisticService.searchUsers(orgId, name.trim(), null, null, 10);
        List<Map<String, Object>> exact = matches.stream()
                .filter(m -> name.trim().equalsIgnoreCase(String.valueOf(m.get("fullName"))))
                .collect(java.util.stream.Collectors.toList());
        return !exact.isEmpty() ? exact : matches;
    }

    /** Nhãn kèm đơn vị/chức vụ để phân biệt người trùng tên; giá trị gửi lại là TÊN đầy đủ. */
    public List<FollowupContextStore.ClarificationOption> userOptions(List<Map<String, Object>> pool) {
        List<FollowupContextStore.ClarificationOption> options = new ArrayList<>();
        for (Map<String, Object> user : pool) {
            String name = user.get("fullName") != null ? String.valueOf(user.get("fullName")) : null;
            if (name == null || name.isBlank()) continue;
            Object unitName = user.get("orgUnitName");
            Object position = user.get("positionName");
            StringBuilder label = new StringBuilder(name);
            if (unitName != null || position != null) {
                label.append(" (");
                if (position != null) label.append(position);
                if (position != null && unitName != null) label.append(" — ");
                if (unitName != null) label.append(unitName);
                label.append(')');
            }
            options.add(new FollowupContextStore.ClarificationOption(label.toString(), name));
        }
        return options;
    }

    /** Envelope hỏi làm rõ khi một tên người khớp nhiều/không thấy. */
    public Map<String, Object> userClarification(String query, List<Map<String, Object>> pool,
                                                 ToolContext context) {
        String convId = getConversationId(context);
        if (convId != null) followupContextStore.markDisambiguating(convId, userOptions(pool));
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("query", query);
        group.put("reason", pool.isEmpty() ? "not_found" : "ambiguous");
        group.put("options", pool);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("needsClarification", true);
        out.put("ambiguous", java.util.List.of(group));
        out.put("message", "Tên '" + query + "' khớp NHIỀU người (hoặc không tìm thấy). Hãy hỏi người "
                + "dùng chọn RÕ người nào (nêu đơn vị/chức vụ để phân biệt) rồi gọi lại. "
                + "TUYỆT ĐỐI không tự chọn giúp.");
        return out;
    }

    /**
     * Resolve người theo id hoặc theo tên.
     *
     * <p>Khác {@link #resolveUnit} ở một chỗ: KHÔNG có giá trị mặc định. Không nêu ai thì trả
     * {@code null} để nơi gọi hiểu là "mọi người", chứ không tự hiểu thành chính người đang hỏi —
     * "duyệt bài nộp" mà mặc định thành "bài nộp của tôi" là hiểu sai hoàn toàn ý người dùng.
     */
    public UserRef resolveUser(String userId, String userName, ToolContext context) {
        if (notBlank(userId)) {
            UUID id = parseId(userId, "người dùng (userId)", "search");
            guardDisambiguation("user", id, "người", context);
            validateUserAccess(id, context);
            return new UserRef(id, null);
        }
        if (notBlank(userName)) {
            List<Map<String, Object>> pool = userMatchPool(userName, getOrgId(context));
            if (pool.size() == 1) {
                UUID id = UUID.fromString(String.valueOf(pool.get(0).get("id")));
                validateUserAccess(id, context);
                return new UserRef(id, null);
            }
            return new UserRef(null, userClarification(userName.trim(), pool, context));
        }
        return new UserRef(null, null);
    }

    /** Các KPI khớp TÊN trong tổ chức, ưu tiên khớp CHÍNH XÁC (gom mọi bản cùng tên, vd theo tuần). */
    public List<Map<String, Object>> kpiMatchPool(String name, UUID orgId) {
        List<Map<String, Object>> matches = orgUnitStatisticService.searchKpis(orgId, name.trim(), 50);
        List<Map<String, Object>> exact = matches.stream()
                .filter(m -> name.trim().equalsIgnoreCase(String.valueOf(m.get("name"))))
                .collect(java.util.stream.Collectors.toList());
        return !exact.isEmpty() ? exact : matches;
    }

    /**
     * Đổi các đơn vị khớp thành lựa chọn bấm được: nhãn kèm cấp/đơn vị cha để phân biệt, còn
     * giá trị gửi lại là TÊN đơn vị — đúng thứ các tool nhận qua unitName.
     */
    public List<FollowupContextStore.ClarificationOption> unitOptions(List<Map<String, Object>> pool) {
        List<FollowupContextStore.ClarificationOption> options = new ArrayList<>();
        for (Map<String, Object> unit : pool) {
            String name = unit.get("name") != null ? String.valueOf(unit.get("name")) : null;
            if (name == null || name.isBlank()) continue;
            Object levelName = unit.get("levelName");
            Object parentName = unit.get("parentName");
            StringBuilder label = new StringBuilder(name);
            if (levelName != null || parentName != null) {
                label.append(" (");
                if (levelName != null) label.append(levelName);
                if (levelName != null && parentName != null) label.append(" — ");
                if (parentName != null) label.append("thuộc ").append(parentName);
                label.append(")");
            }
            options.add(new FollowupContextStore.ClarificationOption(label.toString(), name));
        }
        return options;
    }

    /** Envelope yêu cầu làm rõ khi 1 tên đơn vị khớp nhiều/không thấy (cho các tool 1 đơn vị). */
    public Map<String, Object> unitClarification(String query, List<Map<String, Object>> pool, ToolContext context) {
        String convId = getConversationId(context);
        if (convId != null) followupContextStore.markDisambiguating(convId, unitOptions(pool));
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
    public UnitRef resolveUnit(String unitId, String unitName, ToolContext context) {
        if (unitId != null && !unitId.isBlank()) {
            UUID id = parseId(unitId, "đơn vị (unitId)", "search");
            guardDisambiguation("orgUnit", id, "đơn vị", context);
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
     * Tên kỳ KPI → id, hoặc {@code null} khi không nêu tên.
     *
     * <p>Cùng khuôn với {@code FormFillSupport.period}: không tìm thấy hoặc trùng nhiều thì ném lỗi
     * viết CHO MODEL đọc, kèm chỉ dẫn cụ thể để nó tự sửa trong lượt.
     *
     * <p>Vì sao phải có: các tool thống kê BSC nhận khoảng kỳ. Bỏ qua tham số kỳ mà vẫn trả số của
     * MỌI kỳ chính là kiểu hỏng âm thầm mà tệp khai báo tham số đã cảnh báo — model tưởng đã lọc
     * rồi kết luận trên dữ liệu chưa lọc.
     */
    public UUID resolvePeriodId(String periodName, ToolContext context) {
        if (!notBlank(periodName)) return null;
        List<Map<String, Object>> found =
                orgUnitStatisticService.searchKpiPeriods(getOrgId(context), periodName.trim(), 5);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy kỳ KPI nào tên '" + periodName
                    + "'. Dùng search (entityType=period) để xem các kỳ đang có rồi nêu đúng tên.");
        }
        if (found.size() > 1) {
            throw new IllegalArgumentException("Tên kỳ '" + periodName + "' khớp nhiều kỳ: "
                    + found.stream().map(m -> String.valueOf(m.get("name"))).toList()
                    + ". Hãy hỏi người dùng chọn kỳ nào.");
        }
        return UUID.fromString(String.valueOf(found.get(0).get("id")));
    }

    // ── hỏi làm rõ khi trùng tên ─────────────────────────────────────────────

    /**
     * Refuses to act on an ID that was flagged ambiguous (same-named) by a search
     * in the current turn, forcing the assistant to ask the user to choose first.
     */
    public void guardDisambiguation(String entityType, UUID id, String entityLabel,
                                    ToolContext context) {
        AgentState state = AgentState.from(context);
        if (state != null && state.isArmed(entityType, id)) {
            throw new IllegalStateException("Có nhiều " + entityLabel + " trùng tên vừa được tìm thấy. "
                    + "Hãy đưa danh sách cho người dùng chọn rồi mới xem chi tiết, không tự chọn giúp.");
        }
    }

    /**
     * Returns the subset of results whose display name (under {@code nameKey})
     * collides with at least one other result. Empty if every name is unique.
     */
    public List<Map<String, Object>> findDuplicateNameGroup(List<Map<String, Object>> results, String nameKey) {
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
    public boolean alreadyAskedPriorTurn(String conversationId, String collisionName,
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

    public String collisionName(List<Map<String, Object>> dup, String nameKey) {
        if (dup.isEmpty()) return null;
        Object name = dup.get(0).get(nameKey);
        return name != null ? name.toString() : null;
    }

    public Set<UUID> collectIds(List<Map<String, Object>> items) {
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

    public String ambiguousEnvelope(String entityLabel, String arrayKey, List<Map<String, Object>> results) throws Exception {
        return ambiguousEnvelope(entityLabel, arrayKey, results, null);
    }

    /**
     * @param aggregateHint gợi ý riêng theo loại thực thể về việc KHI NÀO không cần hỏi lại;
     *                      {@code null} thì giữ nguyên hành vi "luôn hỏi trước khi xem chi tiết"
     */
    public String ambiguousEnvelope(String entityLabel, String arrayKey,
                                    List<Map<String, Object>> results, String aggregateHint) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "NEEDS_DISAMBIGUATION");
        String message = "Có nhiều " + entityLabel + " trùng tên. Hãy hiển thị danh sách bên dưới (kèm thông tin phân biệt) "
                + "và yêu cầu người dùng chọn đúng mục mong muốn TRƯỚC KHI xem chi tiết.";
        if (notBlank(aggregateHint)) {
            message = aggregateHint + " " + message;
        }
        result.put("message", message);
        result.put("count", results.size());
        result.put(arrayKey, results);
        return toolMapper.writeValueAsString(result);
    }

    /**
     * Mark the conversation as disambiguating, then return the ambiguous envelope.
     * Suppresses follow-up question generation until user makes a selection.
     */
    public String returnAmbiguous(String toolName, String entityLabel, String arrayKey,
                                  List<Map<String, Object>> results, String aggregateHint,
                                  ToolContext context) throws Exception {
        // Đây là đường ra THỨ HAI của một tool chạy thành công — nó KHÔNG đi qua respond(), nên
        // phải tự ghi nhận. Bỏ sót chỗ này khiến ValidationStage tưởng lượt đó không lấy được dữ
        // liệu nào rồi chặn nhầm chính câu hỏi làm rõ hợp lệ (đã đo được: 4 câu bị chặn oan).
        log.info("AI-TOOL-CALL {}", toolName);
        recordSuccess(context, toolName);
        ToolProgress.announce(context, toolName);

        String convId = getConversationId(context);
        if (convId != null) {
            followupContextStore.markDisambiguating(convId);
        }
        return ambiguousEnvelope(entityLabel, arrayKey, results, aggregateHint);
    }

    /**
     * Ghi một tool đã chạy xong vào trạng thái của lượt.
     *
     * <p>Chịu được việc vắng trạng thái: tool còn chạy ở test dựng {@code ToolContext} trần, và
     * ném lỗi giữa một lượt đang chạy chỉ vì không ghi được sổ thì tệ hơn nhiều so với không ghi.
     */
    private static void recordSuccess(ToolContext context, String toolName) {
        AgentState state = AgentState.from(context);
        if (state != null) state.recordSuccess(toolName);
    }

    public void armDisambiguation(String entityType, Set<UUID> ids, ToolContext context) {
        AgentState state = AgentState.from(context);
        if (state != null) state.arm(entityType, ids);
    }

    /**
     * Serializes a tool's payload to JSON, records it in the {@link FollowupContextStore}
     * (keyed by conversationId, when present) so follow-up questions can be grounded in the
     * real tool data of this turn, and returns the JSON for the model.
     */
    public String respond(ToolContext context, String toolName, Object payload) throws Exception {
        // Mọi tool chạy THÀNH CÔNG đều đi qua đây. Trước đây chỉ tool lỗi mới ghi log, nên với câu
        // hỏi cần nhiều tool không có cách nào biết model gọi đủ hay chỉ gọi một rồi đoán phần còn
        // lại — mà đoán vẫn ra câu trả lời trôi chảy. Một dòng này cho phép dựng lại đúng chuỗi
        // tool của từng lượt khi chấm bộ câu hỏi kiểm thử.
        log.info("AI-TOOL-CALL {}", toolName);
        // Ghi lại để ValidationStage biết lượt này có thật sự lấy được dữ liệu hay không.
        recordSuccess(context, toolName);
        // ...và nói cho người dùng biết trợ lý vừa xem cái gì; vòng gọi tool là quãng chờ dài nhất
        // của một lượt nên im lặng ở đây nhìn không khác gì treo máy.
        ToolProgress.announce(context, toolName);
        String json = toolMapper.writeValueAsString(payload);
        String conversationId = getConversationId(context);
        if (conversationId != null) {
            followupContextStore.append(conversationId, toolName, json);
        }
        return json;
    }
}
