package com.kpitracking.service.task;

import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.TaskFieldType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Tìm việc cho mọi chế độ xem (Của tôi, Đơn vị, Danh sách, KPI, tìm kiếm chung) — dựng SQL thuần theo bộ lọc đang dùng
 * rồi trả id theo thứ tự; người gọi nạp entity.
 *
 * <p>Vị từ "xem được" ({@link #VISIBLE}) là bản SQL của {@link KpiTaskAccess.Scope#canView}: người tạo / thực hiện / theo
 * dõi của việc hoặc tổ tiên; thành viên danh sách chứa việc gốc (chỉ việc không KPI, không riêng tư); cấp trên
 * ({@code TASK:VIEW_TEAM}) với việc {@code KPI_SCOPE}. Nhánh cấp trên của việc có KPI hẹp hơn bản Java (chỉ đơn vị mình
 * quản lý, như tab Đơn vị trước nay) — SQL luôn là TẬP CON của Java, không bao giờ rộng hơn. Sửa luật: sửa cả hai.
 */
@Component
@RequiredArgsConstructor
public class TaskSearch {

    public static final Set<String> VIEWS = Set.of("ASSIGNED", "FOLLOWING", "CREATED", "DELEGATED", "INVOLVED", "TEAM",
            "LIST", "KPI", "SEARCH");
    private static final UUID NONE = new UUID(0, 0);

    private final EntityManager em;

    /** Lọc theo một trường tuỳ chỉnh (chỉ trong một danh sách). op: EQ | IN | CONTAINS | EMPTY | NOT_EMPTY | GT | LT. */
    public record FieldFilter(UUID fieldId, TaskFieldType type, String op, Object value) {}

    public record Criteria(
            String view, UUID me, UUID orgId,
            UUID listId, UUID sectionId, boolean noSection,
            UUID kpiId, Boolean hasKpi, UUID periodId, UUID assigneeId,
            List<KpiTaskStatus> statuses, KpiTaskPriority priority,
            boolean noDue, LocalDate dueFrom, LocalDate dueTo, boolean overdue,
            LocalDate rangeFrom, LocalDate rangeTo,
            String keyword, List<UUID> tagIds, List<FieldFilter> fieldFilters,
            String sort, UUID sortFieldId, TaskFieldType sortFieldType, boolean topLevel,
            // Ngữ cảnh quyền của người xem
            Collection<UUID> myListIds, boolean viewTeam, List<String> managerPaths, boolean admin, boolean kpiTeam,
            LocalDate today, LocalTime nowTime, int page, int size) {}

    public record Result(List<UUID> ids, long total) {}

    // ── Mảnh SQL dùng chung ────────────────────────────────────────────────────────────────────────

    static final String INVOLVED_ME = "(t.created_by = :me "
            + "OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) "
            + "OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))";

    static final String TREE_INVOLVED = "(" + INVOLVED_ME
            + " OR EXISTS (SELECT 1 FROM kpi_tasks x WHERE x.id = ANY(t.ancestor_ids) AND x.created_by = :me)"
            + " OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = ANY(t.ancestor_ids) AND a.user_id = :me)"
            + " OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = ANY(t.ancestor_ids) AND f.user_id = :me))";

    static final String LIST_GRANT = "(t.kpi_criteria_id IS NULL AND t.visibility <> 'PRIVATE' AND EXISTS ("
            + "SELECT 1 FROM task_list_items lg WHERE lg.task_id = COALESCE(t.root_task_id, t.id) AND lg.list_id IN (:myLists)))";

    private static String team(List<String> paths) {
        String kpiPaths = pathAny("ku.path", paths);
        String userPaths = pathAny("ou.path", paths);
        return "(:viewTeam AND t.visibility = 'KPI_SCOPE' AND ("
                + "(t.kpi_criteria_id IS NOT NULL AND k.id IS NOT NULL AND k.status IN ('APPROVED', 'EDIT', 'EDITED') AND " + kpiPaths + ")"
                + " OR (t.kpi_criteria_id IS NULL AND ((:admin AND t.organization_id = :orgId) OR EXISTS ("
                + "     SELECT 1 FROM kpi_task_assignees ta JOIN user_role_org_units uro ON uro.user_id = ta.user_id "
                + "       JOIN org_units ou ON ou.id = uro.org_unit_id WHERE ta.task_id = t.id AND " + userPaths + ")))))";
    }

    private static String visible(List<String> paths) {
        return "(" + TREE_INVOLVED + " OR " + LIST_GRANT + " OR " + team(paths) + ")";
    }

    /** Vị từ "xem được" (dùng cho tài liệu / test). */
    public static final String VISIBLE = "TREE_INVOLVED OR LIST_GRANT OR TEAM";

    private static String pathAny(String col, List<String> paths) {
        if (paths == null || paths.isEmpty()) return "FALSE";
        StringJoiner j = new StringJoiner(" OR ", "(", ")");
        for (int i = 0; i < paths.size(); i++) j.add(col + " LIKE :mp" + i);
        return j.toString();
    }

    // ── Tìm ───────────────────────────────────────────────────────────────────────────────────────

    public Result search(Criteria c) {
        Map<String, Object> p = new HashMap<>();
        StringBuilder from = new StringBuilder(" FROM kpi_tasks t "
                + "LEFT JOIN kpi_criteria k ON k.id = t.kpi_criteria_id AND k.deleted_at IS NULL "
                + "LEFT JOIN org_units ku ON ku.id = k.org_unit_id ");
        String view = c.view() == null ? "ASSIGNED" : c.view();
        boolean inList = "LIST".equals(view) && c.listId() != null;
        if (inList) {
            from.append("JOIN task_list_items li ON li.task_id = t.id AND li.list_id = :listId ");
            p.put("listId", c.listId());
        }
        boolean fieldSort = inList && c.sortFieldId() != null;
        if (fieldSort) {
            from.append("LEFT JOIN task_field_values sfv ON sfv.task_id = t.id AND sfv.field_id = :sortField ");
            p.put("sortField", c.sortFieldId());
        }

        List<String> where = new ArrayList<>();
        where.add("t.deleted_at IS NULL");
        List<KpiTaskStatus> statuses = c.statuses() == null || c.statuses().isEmpty()
                ? List.of(KpiTaskStatus.values()) : c.statuses();
        where.add("t.status IN (:statuses)");
        p.put("statuses", statuses.stream().map(Enum::name).toList());
        p.put("me", c.me());

        boolean usesVisible = false, usesTeam = false;
        switch (view) {
            case "ASSIGNED" -> where.add("EXISTS (SELECT 1 FROM kpi_task_assignees a0 WHERE a0.task_id = t.id AND a0.user_id = :me)");
            case "FOLLOWING" -> where.add("EXISTS (SELECT 1 FROM kpi_task_followers f0 WHERE f0.task_id = t.id AND f0.user_id = :me)");
            case "CREATED" -> where.add("t.created_by = :me");
            case "DELEGATED" -> where.add("t.created_by = :me AND EXISTS (SELECT 1 FROM kpi_task_assignees a0 "
                    + "WHERE a0.task_id = t.id AND a0.user_id <> :me)");
            case "INVOLVED" -> where.add(INVOLVED_ME);
            case "TEAM" -> {
                where.add(team(c.managerPaths()));
                where.add("NOT EXISTS (SELECT 1 FROM kpi_task_assignees a0 WHERE a0.task_id = t.id AND a0.user_id = :me)");
                usesTeam = true;
            }
            case "KPI" -> {
                where.add("t.kpi_criteria_id = :kpiView");
                where.add("(" + INVOLVED_ME + " OR (:kpiTeam AND t.visibility = 'KPI_SCOPE'))");
                p.put("kpiView", c.kpiId());
                p.put("kpiTeam", c.kpiTeam());
            }
            case "LIST", "SEARCH" -> {
                where.add(visible(c.managerPaths()));
                usesVisible = true;
            }
            default -> where.add("FALSE");
        }
        if (usesVisible) {
            Collection<UUID> lists = c.myListIds() == null || c.myListIds().isEmpty() ? List.of(NONE) : c.myListIds();
            p.put("myLists", lists);
        }
        if (usesVisible || usesTeam) {
            p.put("viewTeam", c.viewTeam());
            p.put("admin", c.admin());
            p.put("orgId", c.orgId() != null ? c.orgId() : NONE);
            List<String> paths = c.managerPaths() == null ? List.of() : c.managerPaths();
            for (int i = 0; i < paths.size(); i++) p.put("mp" + i, paths.get(i) + "%");
        }

        // ── Bộ lọc ──
        if (c.kpiId() != null && !"KPI".equals(view)) {
            where.add("t.kpi_criteria_id = :kpiId");
            p.put("kpiId", c.kpiId());
        }
        if (c.hasKpi() != null) where.add(c.hasKpi() ? "t.kpi_criteria_id IS NOT NULL" : "t.kpi_criteria_id IS NULL");
        if (c.periodId() != null) {
            where.add("k.kpi_period_id = :periodId");
            p.put("periodId", c.periodId());
        }
        if (c.assigneeId() != null) {
            where.add("EXISTS (SELECT 1 FROM kpi_task_assignees af WHERE af.task_id = t.id AND af.user_id = :assignee)");
            p.put("assignee", c.assigneeId());
        }
        if (c.priority() != null) {
            where.add("t.priority = :priority");
            p.put("priority", c.priority().name());
        }
        if (c.topLevel()) where.add("t.parent_task_id IS NULL");
        if (c.noDue()) where.add("t.due_date IS NULL");
        if (c.dueFrom() != null) {
            where.add("t.due_date >= :dueFrom");
            p.put("dueFrom", c.dueFrom());
        }
        if (c.dueTo() != null) {
            where.add("t.due_date <= :dueTo");
            p.put("dueTo", c.dueTo());
        }
        if (c.overdue()) {
            where.add("t.status IN ('TODO', 'IN_PROGRESS') AND (t.due_date < :today "
                    + "OR (t.due_date = :today AND t.due_time IS NOT NULL AND t.due_time < :nowTime))");
            p.put("today", c.today());
            p.put("nowTime", c.nowTime());
        }
        if (c.rangeFrom() != null && c.rangeTo() != null) {
            // Gantt / lịch nhiều ngày: việc có khoảng [bắt đầu, hạn] chạm khoảng đang xem.
            where.add("COALESCE(t.start_date, t.due_date) <= :rangeTo AND COALESCE(t.due_date, t.start_date) >= :rangeFrom");
            p.put("rangeFrom", c.rangeFrom());
            p.put("rangeTo", c.rangeTo());
        }
        if (c.keyword() != null && !c.keyword().isBlank()) {
            where.add("(t.title ILIKE :kw OR t.description ILIKE :kw)");
            p.put("kw", "%" + c.keyword().trim().replace("%", "\\%").replace("_", "\\_") + "%");
        }
        if (c.tagIds() != null && !c.tagIds().isEmpty()) {
            where.add("EXISTS (SELECT 1 FROM task_tag_links tl WHERE tl.task_id = t.id AND tl.tag_id IN (:tags))");
            p.put("tags", c.tagIds());
        }
        if (inList && c.sectionId() != null) {
            where.add("li.section_id = :section");
            p.put("section", c.sectionId());
        } else if (inList && c.noSection()) {
            where.add("li.section_id IS NULL");
        }
        if (inList && c.fieldFilters() != null) {
            int i = 0;
            for (FieldFilter ff : c.fieldFilters()) {
                String sql = fieldPredicate(ff, i, p);
                if (sql != null) where.add(sql);
                i++;
            }
        }

        String whereSql = " WHERE " + String.join(" AND ", where);
        String order = " ORDER BY " + orderBy(c.sort(), inList, fieldSort, c.sortFieldType()) + ", t.id";
        Query q = em.createNativeQuery("SELECT t.id" + from + whereSql + order);
        Query count = em.createNativeQuery("SELECT COUNT(*)" + from + whereSql);
        p.forEach((k, v) -> {
            q.setParameter(k, v);
            count.setParameter(k, v);
        });
        int size = Math.max(1, c.size());
        q.setFirstResult(Math.max(0, c.page()) * size);
        q.setMaxResults(size);
        @SuppressWarnings("unchecked")
        List<Object> rows = q.getResultList();
        List<UUID> ids = rows.stream().map(o -> o instanceof UUID u ? u : UUID.fromString(o.toString())).toList();
        long total = ((Number) count.getSingleResult()).longValue();
        return new Result(ids, total);
    }

    private static String fieldPredicate(FieldFilter ff, int i, Map<String, Object> p) {
        if (ff.fieldId() == null || ff.op() == null) return null;
        String fid = "ff" + i, fv = "fv" + i;
        p.put(fid, ff.fieldId());
        String exists = "EXISTS (SELECT 1 FROM task_field_values v" + i + " WHERE v" + i + ".task_id = t.id AND v" + i
                + ".field_id = :" + fid;
        String val = "v" + i + ".value->>'v'";
        switch (ff.op().toUpperCase(Locale.ROOT)) {
            case "EMPTY" -> {
                return "NOT " + exists + ")";
            }
            case "NOT_EMPTY" -> {
                return exists + ")";
            }
            case "EQ" -> {
                p.put(fv, TaskFieldCodec.wrapJson(ff.value()));
                return exists + " AND v" + i + ".value @> CAST(:" + fv + " AS jsonb))";
            }
            case "IN" -> {
                // MULTI_SELECT: chứa MỘT trong các lựa chọn; SINGLE_SELECT / MEMBER: bằng một trong các giá trị.
                List<?> values = ff.value() instanceof Collection<?> col ? new ArrayList<>(col) : List.of(ff.value());
                if (values.isEmpty()) return null;
                StringJoiner j = new StringJoiner(" OR ", "(", ")");
                for (int k = 0; k < values.size(); k++) {
                    String name = fv + "_" + k;
                    Object one = ff.type() == TaskFieldType.MULTI_SELECT ? List.of(values.get(k)) : values.get(k);
                    p.put(name, TaskFieldCodec.wrapJson(one));
                    j.add("v" + i + ".value @> CAST(:" + name + " AS jsonb)");
                }
                return exists + " AND " + j + ")";
            }
            case "CONTAINS" -> {
                p.put(fv, "%" + String.valueOf(ff.value()).replace("%", "\\%") + "%");
                return exists + " AND " + val + " ILIKE :" + fv + ")";
            }
            case "GT", "LT" -> {
                String cmp = "GT".equalsIgnoreCase(ff.op()) ? ">" : "<";
                if (ff.type() == TaskFieldType.DATE) {
                    p.put(fv, LocalDate.parse(String.valueOf(ff.value())));
                    return exists + " AND CAST(" + val + " AS date) " + cmp + " :" + fv + ")";
                }
                p.put(fv, new java.math.BigDecimal(String.valueOf(ff.value())));
                return exists + " AND CAST(" + val + " AS numeric) " + cmp + " :" + fv + ")";
            }
            default -> {
                return null;
            }
        }
    }

    private static String orderBy(String sort, boolean inList, boolean fieldSort, TaskFieldType fieldType) {
        String s = sort == null ? "due" : sort.toLowerCase(Locale.ROOT);
        if (fieldSort) {
            String v = "sfv.value->>'v'";
            String expr = fieldType == TaskFieldType.NUMBER ? "CAST(" + v + " AS numeric)"
                    : fieldType == TaskFieldType.DATE ? "CAST(" + v + " AS date)" : "LOWER(" + v + ")";
            return expr + " ASC NULLS LAST, t.due_date ASC NULLS LAST";
        }
        return switch (s) {
            case "manual" -> inList ? "li.sort_order ASC, t.created_at ASC" : "t.sort_order ASC, t.created_at ASC";
            case "created" -> "t.created_at DESC";
            case "updated" -> "t.updated_at DESC";
            case "title" -> "LOWER(t.title) ASC";
            case "start" -> "COALESCE(t.start_date, t.due_date) ASC NULLS LAST, t.due_date ASC NULLS LAST";
            case "priority" -> "CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, t.due_date ASC NULLS LAST";
            default -> "t.due_date ASC NULLS LAST, t.due_time ASC NULLS LAST, t.sort_order ASC";
        };
    }
}
