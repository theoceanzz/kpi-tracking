package com.kpitracking.repository;

import com.kpitracking.entity.KpiTask;
import com.kpitracking.enums.KpiTaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Công việc. Danh sách theo chế độ xem / bộ lọc đi qua {@code TaskSearch} (SQL dựng động); ở đây là các truy vấn cố định.
 * "Người thực hiện" luôn đọc từ {@code kpi_task_assignees} ({@code owner_id} chỉ là người chính).
 */
@Repository
public interface KpiTaskRepository extends JpaRepository<KpiTask, UUID> {

    /**
     * Tiến độ việc (chỉ việc CẤP CAO NHẤT — việc con đã tính trong việc cha) theo KPI cho người xem:
     * [kpi_id, done, total (không tính huỷ), overdue]. Thấy: việc mình liên quan, và (nếu {@code team}) việc công khai.
     * DONE = trạng thái của VIỆC (đã thoả kiểu hoàn thành), không đếm phần từng người.
     */
    @Query(value = "SELECT t.kpi_criteria_id, " +
            "  COUNT(*) FILTER (WHERE t.status = 'DONE'), " +
            "  COUNT(*) FILTER (WHERE t.status <> 'CANCELLED'), " +
            "  COUNT(*) FILTER (WHERE t.status IN ('TODO', 'IN_PROGRESS') AND t.due_date < :today) " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.parent_task_id IS NULL AND t.kpi_criteria_id IN (:kpiIds) " +
            "  AND (t.created_by = :viewerId " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :viewerId) " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :viewerId) " +
            "       OR (:team AND t.visibility = 'KPI_SCOPE')) " +
            "GROUP BY t.kpi_criteria_id", nativeQuery = true)
    List<Object[]> progressFor(@Param("kpiIds") Collection<UUID> kpiIds, @Param("viewerId") UUID viewerId,
                               @Param("team") boolean team, @Param("today") LocalDate today);

    @Query("SELECT t FROM KpiTask t WHERE t.parentTaskId = :parentId ORDER BY t.sortOrder, t.createdAt")
    List<KpiTask> findSubtasks(@Param("parentId") UUID parentId);

    /** Mọi hậu duệ (con, cháu…) của một việc. */
    @Query(value = "SELECT * FROM kpi_tasks WHERE CAST(:id AS uuid) = ANY(ancestor_ids) AND deleted_at IS NULL " +
            "ORDER BY depth, sort_order, created_at", nativeQuery = true)
    List<KpiTask> findDescendants(@Param("id") UUID id);

    /** Tiến độ việc con TRỰC TIẾP theo task cha: [parent_id, done, total (không tính huỷ)]. */
    @Query(value = "SELECT t.parent_task_id, COUNT(*) FILTER (WHERE t.status = 'DONE'), COUNT(*) FILTER (WHERE t.status <> 'CANCELLED') " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.parent_task_id IN (:parentIds) GROUP BY t.parent_task_id",
            nativeQuery = true)
    List<Object[]> subtaskProgress(@Param("parentIds") Collection<UUID> parentIds);

    /** Số hậu duệ chưa xong (mọi cấp). */
    @Query(value = "SELECT COUNT(*) FROM kpi_tasks WHERE CAST(:id AS uuid) = ANY(ancestor_ids) AND deleted_at IS NULL " +
            "AND status IN ('TODO', 'IN_PROGRESS')", nativeQuery = true)
    long countOpenSubtasks(@Param("id") UUID parentId);

    @Query("SELECT COALESCE(MAX(t.sortOrder), 0) FROM KpiTask t WHERE t.owner.id = :ownerId AND t.status = :status")
    double maxSortOrder(@Param("ownerId") UUID ownerId, @Param("status") KpiTaskStatus status);

    /** Việc chưa xong mà {@code userId} đang thực hiện trên một KPI. */
    @Query("SELECT t FROM KpiTask t WHERE t.kpiCriteriaId = :kpiId " +
           "AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS) " +
           "AND EXISTS (SELECT 1 FROM KpiTaskAssignee a WHERE a.taskId = t.id AND a.userId = :ownerId)")
    List<KpiTask> findOpenByOwnerAndKpi(@Param("ownerId") UUID ownerId, @Param("kpiId") UUID kpiId);

    // ── Khoá cây việc ─────────────────────────────────────────────────────────────────────────

    /** Việc gốc của cây (chính nó nếu là gốc). Câu thuần SQL để không nạp entity trước khi khoá. */
    @Query(value = "SELECT COALESCE(root_task_id, id) FROM kpi_tasks WHERE id = :id AND deleted_at IS NULL", nativeQuery = true)
    Optional<UUID> rootIdOf(@Param("id") UUID id);

    /**
     * Khoá dòng (FOR UPDATE) của các việc gốc, theo thứ tự id để hai thao tác khoá nhiều dòng không khoá chéo nhau. Đổi
     * KPI và thêm người theo dõi cùng xếp hàng qua khoá này, nên người được thêm luôn được kiểm theo KPI đã chốt.
     */
    @Query(value = "SELECT id FROM kpi_tasks WHERE id IN (:ids) ORDER BY id FOR UPDATE", nativeQuery = true)
    List<UUID> lockRows(@Param("ids") Collection<UUID> ids);

    // ── Chuỗi lặp ─────────────────────────────────────────────────────────────────────────────

    boolean existsBySeriesIdAndSeriesIndex(UUID seriesId, Integer seriesIndex);

    /** Các lần CHƯA XONG của chuỗi từ lần {@code fromIndex} trở đi — "lần này và các lần sau". */
    @Query("SELECT t FROM KpiTask t WHERE t.seriesId = :seriesId AND t.seriesIndex >= :fromIndex " +
           "AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS)")
    List<KpiTask> findOpenInSeriesFrom(@Param("seriesId") UUID seriesId, @Param("fromIndex") int fromIndex);

    // ── Đếm cho cột trái + huy hiệu ─────────────────────────────────────────────────────────────

    /** Số việc CHƯA XONG theo chế độ xem: [assigned, following, created, delegated, involved]. */
    @Query(value = "SELECT " +
            "  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me)), " +
            "  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me)), " +
            "  COUNT(*) FILTER (WHERE t.created_by = :me), " +
            "  COUNT(*) FILTER (WHERE t.created_by = :me AND EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id <> :me)), " +
            "  COUNT(*) " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') " +
            "  AND (t.created_by = :me " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))",
            nativeQuery = true)
    List<Object[]> viewCounts(@Param("me") UUID me);

    /**
     * Huy hiệu menu: việc tôi thực hiện, chưa xong, đã quá hạn hoặc tới hạn hôm nay — kiểu ALL thì chỉ khi phần của tôi
     * chưa tích.
     */
    @Query(value = "SELECT COUNT(*) FROM kpi_tasks t JOIN kpi_task_assignees a ON a.task_id = t.id AND a.user_id = :me " +
            "WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') AND t.due_date <= :today " +
            "AND (t.completion_mode = 'ANY' OR a.completed_at IS NULL)", nativeQuery = true)
    long badgeCount(@Param("me") UUID me, @Param("today") LocalDate today);

    /**
     * KPI của tôi (tạo hoặc thực hiện, còn nhận việc) trong đợt đang diễn ra, kèm số việc chưa xong tôi liên quan:
     * [kpi_id, kpi_name, open_count]. Không có đợt nào đang diễn ra thì trả rỗng — giao diện dùng bộ lọc đợt.
     */
    @Query(value = "SELECT k.id, k.name, " +
            "  (SELECT COUNT(*) FROM kpi_tasks t WHERE t.kpi_criteria_id = k.id AND t.deleted_at IS NULL " +
            "     AND t.status IN ('TODO', 'IN_PROGRESS') AND (t.created_by = :me " +
            "     OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) " +
            "     OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))) " +
            "FROM kpi_criteria k JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "WHERE k.deleted_at IS NULL AND p.deleted_at IS NULL " +
            "  AND k.status IN ('DRAFT', 'PENDING_APPROVAL', 'EDIT', 'EDITED', 'APPROVED', 'REJECTED') " +
            "  AND p.start_date <= :now AND p.end_date >= :now " +
            "  AND (k.created_by = :me OR EXISTS (SELECT 1 FROM kpi_criteria_assignees a WHERE a.kpi_criteria_id = k.id AND a.user_id = :me)) " +
            "ORDER BY k.name", nativeQuery = true)
    List<Object[]> myCurrentKpis(@Param("me") UUID me, @Param("now") Instant now);

    /** Số việc KHÔNG KPI chưa xong mà tôi liên quan (mục "Việc không gắn KPI" ở cột trái). */
    @Query(value = "SELECT COUNT(*) FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.kpi_criteria_id IS NULL " +
            "AND t.status IN ('TODO', 'IN_PROGRESS') AND (t.created_by = :me " +
            "  OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) " +
            "  OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))", nativeQuery = true)
    long countMyOpenWithoutKpi(@Param("me") UUID me);

    // ── Ô chọn người / KPI khi giao việc ────────────────────────────────────────────────────────

    /**
     * Người mình được giao việc trên KPI: người thuộc đơn vị mình là trưởng/phó (rank ≤ 1) hoặc đơn vị con; quản trị viên
     * ({@code admin}) thì cả tổ chức {@code orgId}. [user_id, full_name].
     */
    @Query(value = "SELECT DISTINCT u.id, u.full_name FROM users u " +
            "JOIN user_role_org_units uro ON uro.user_id = u.id " +
            "JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL " +
            "JOIN org_hierarchy_levels hl ON hl.id = ou.org_hierarchy_id " +
            "WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE' " +
            "  AND ((:admin AND hl.organization_id = :orgId) OR EXISTS (" +
            "        SELECT 1 FROM user_role_org_units m JOIN roles r ON r.id = m.role_id " +
            "          JOIN org_units mu ON mu.id = m.org_unit_id " +
            "         WHERE m.user_id = :me AND r.rank <= 1 AND ou.path LIKE mu.path || '%')) " +
            "  AND (CAST(:q AS TEXT) IS NULL OR u.full_name ILIKE '%' || CAST(:q AS TEXT) || '%' " +
            "       OR u.email ILIKE '%' || CAST(:q AS TEXT) || '%') " +
            "ORDER BY u.full_name LIMIT :lim", nativeQuery = true)
    List<Object[]> assignableUsers(@Param("me") UUID me, @Param("admin") boolean admin, @Param("orgId") UUID orgId,
                                   @Param("q") String q, @Param("lim") int limit);

    /** Mọi người đang hoạt động trong tổ chức (giao việc không KPI, người theo dõi việc không KPI). [user_id]. */
    @Query(value = "SELECT DISTINCT u.id, u.full_name FROM users u " +
            "JOIN user_role_org_units uro ON uro.user_id = u.id " +
            "JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL " +
            "JOIN org_hierarchy_levels hl ON hl.id = ou.org_hierarchy_id " +
            "WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE' AND hl.organization_id = :orgId " +
            "  AND (CAST(:q AS TEXT) IS NULL OR u.full_name ILIKE '%' || CAST(:q AS TEXT) || '%' " +
            "       OR u.email ILIKE '%' || CAST(:q AS TEXT) || '%') " +
            "ORDER BY u.full_name LIMIT :lim", nativeQuery = true)
    List<Object[]> orgMembers(@Param("orgId") UUID orgId, @Param("q") String q, @Param("lim") int limit);

    /** KPI còn nhận việc của một người (tạo hoặc thực hiện), đợt mới nhất trước. */
    @Query(value = "SELECT k.id FROM kpi_criteria k LEFT JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "WHERE k.deleted_at IS NULL " +
            "  AND k.status IN ('DRAFT', 'PENDING_APPROVAL', 'EDIT', 'EDITED', 'APPROVED', 'REJECTED') " +
            "  AND (k.created_by = :owner OR EXISTS (SELECT 1 FROM kpi_criteria_assignees a WHERE a.kpi_criteria_id = k.id AND a.user_id = :owner)) " +
            "ORDER BY p.start_date DESC NULLS LAST, k.name LIMIT 100", nativeQuery = true)
    List<UUID> taskableKpiIdsOf(@Param("owner") UUID owner);

    // ── Vòng đời KPI ────────────────────────────────────────────────────────────────────────────

    /** KPI vừa bị xoá mềm: chụp tên KPI vào task để vẫn hiện "KPI đã xoá: <tên>". */
    @Modifying
    @Query(value = "UPDATE kpi_tasks SET kpi_name_snapshot = :name WHERE kpi_criteria_id = :kpiId AND deleted_at IS NULL",
            nativeQuery = true)
    void snapshotKpiName(@Param("kpiId") UUID kpiId, @Param("name") String name);

    /** Số việc chưa xong theo từng người thực hiện trên một KPI. Trả về [user_id, count]. */
    @Query(value = "SELECT a.user_id, COUNT(*) FROM kpi_tasks t JOIN kpi_task_assignees a ON a.task_id = t.id " +
            "WHERE t.kpi_criteria_id = :kpiId AND t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') " +
            "GROUP BY a.user_id", nativeQuery = true)
    List<Object[]> countOpenByOwner(@Param("kpiId") UUID kpiId);

    // ── Nhắc quá hạn ────────────────────────────────────────────────────────────────────────────

    /**
     * Việc chưa xong ĐÃ QUÁ HẠN, chưa nhắc quá hạn: hạn trước hôm nay, hoặc hôm nay mà giờ hạn đã qua. Việc không KPI;
     * hoặc KPI còn, chưa khoá kỳ (việc của KPI đã xoá là chỉ đọc — không nhắc).
     */
    @Query(value = "SELECT t.* FROM kpi_tasks t " +
            "LEFT JOIN kpi_criteria k ON k.id = t.kpi_criteria_id AND k.deleted_at IS NULL " +
            "LEFT JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "LEFT JOIN kpi_cycles c ON c.id = p.kpi_cycle_id " +
            "WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') AND t.reminded_overdue_at IS NULL " +
            "  AND (t.kpi_criteria_id IS NULL OR (k.id IS NOT NULL AND k.status <> 'CLOSED_BY_LOCK' " +
            "       AND (c.status IS NULL OR c.status <> 'LOCKED'))) " +
            "  AND (t.due_date < :today OR (t.due_date = :today AND t.due_time IS NOT NULL AND t.due_time < :nowTime)) " +
            "ORDER BY t.due_date LIMIT :lim", nativeQuery = true)
    List<KpiTask> findOverdueToRemind(@Param("today") LocalDate today, @Param("nowTime") LocalTime nowTime,
                                      @Param("lim") int limit);

    /** Đánh dấu đã nhắc quá hạn — câu UPDATE thẳng để không tăng {@code version}. */
    @Modifying
    @Query(value = "UPDATE kpi_tasks SET reminded_overdue_at = :at WHERE id = :id AND reminded_overdue_at IS NULL",
            nativeQuery = true)
    int markOverdueReminded(@Param("id") UUID id, @Param("at") Instant at);

    /** Đổi hạn ⇒ được nhắc quá hạn lại theo hạn mới (không tăng version). */
    @Modifying
    @Query(value = "UPDATE kpi_tasks SET reminded_overdue_at = NULL WHERE id = :id", nativeQuery = true)
    void resetOverdueReminder(@Param("id") UUID id);

    /**
     * Bản tóm tắt buổi sáng (như Task Assistant của Lark): mỗi (người thực hiện, tổ chức) số việc chưa xong đến hạn HÔM NAY, đã QUÁ HẠN và đến hạn NGÀY MAI. Một truy vấn
     * gộp cho cả hệ thống (không hỏi từng người). Kiểu "ai cũng phải xong" bỏ người đã tích phần mình.
     */
    @Query(value = "SELECT a.user_id, t.organization_id, "
            + "COUNT(*) FILTER (WHERE t.due_date = :today), COUNT(*) FILTER (WHERE t.due_date < :today), "
            + "COUNT(*) FILTER (WHERE t.due_date = CAST(:today AS date) + 1) "
            + "FROM kpi_tasks t JOIN kpi_task_assignees a ON a.task_id = t.id "
            + "WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') AND t.due_date <= CAST(:today AS date) + 1 "
            + "AND (t.completion_mode <> 'ALL' OR a.completed_at IS NULL) "
            + "GROUP BY a.user_id, t.organization_id", nativeQuery = true)
    List<Object[]> digestCounts(@Param("today") java.time.LocalDate today);
}
