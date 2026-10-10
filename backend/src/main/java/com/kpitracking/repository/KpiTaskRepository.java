package com.kpitracking.repository;

import com.kpitracking.entity.KpiTask;
import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
import java.util.UUID;

@Repository
public interface KpiTaskRepository extends JpaRepository<KpiTask, UUID> {

    /** "Tôi có liên quan": phụ trách, tạo, hoặc theo dõi. Dùng lại trong nhiều câu. */
    String INVOLVED = "(t.owner.id = :me OR t.createdBy = :me OR EXISTS (SELECT 1 FROM KpiTaskFollower f WHERE f.taskId = t.id AND f.userId = :me))";

    /**
     * Danh sách công việc theo chế độ xem (cột trái của trang Công việc) + bộ lọc. LEFT JOIN KPI để task của KPI đã xoá
     * vẫn hiện (trừ khi lọc theo đợt).
     * <ul>
     *   <li>{@code ASSIGNED} tôi phụ trách · {@code FOLLOWING} tôi theo dõi · {@code CREATED} tôi tạo ·
     *       {@code DELEGATED} tôi tạo và giao cho người khác · {@code INVOLVED} có liên quan (Tất cả / Đã hoàn thành);</li>
     *   <li>{@code TEAM}: việc công khai của người khác trên KPI ĐÃ DUYỆT thuộc đơn vị tôi quản lý — cùng vế "cấp trên"
     *       của {@code KpiAccessPolicy} (chỉ KPI APPROVED / EDIT / EDITED);</li>
     *   <li>{@code KPI}: mọi việc tôi thấy được trên một KPI (tab Công việc của KPI).</li>
     * </ul>
     * {@code overdue = true} ⇒ chỉ việc chưa xong đã quá hạn (hạn trước hôm nay, hoặc hôm nay mà giờ hạn đã qua).
     */
    @Query("SELECT t FROM KpiTask t LEFT JOIN KpiCriteria k ON k.id = t.kpiCriteriaId " +
           "WHERE t.status IN :statuses AND (" +
           "  (:view = 'ASSIGNED' AND t.owner.id = :me) OR " +
           "  (:view = 'FOLLOWING' AND EXISTS (SELECT 1 FROM KpiTaskFollower f WHERE f.taskId = t.id AND f.userId = :me)) OR " +
           "  (:view = 'CREATED' AND t.createdBy = :me) OR " +
           "  (:view = 'DELEGATED' AND t.createdBy = :me AND t.owner.id <> :me) OR " +
           "  (:view = 'INVOLVED' AND " + INVOLVED + ") OR " +
           "  (:view = 'TEAM' AND t.visibility = com.kpitracking.enums.KpiTaskVisibility.KPI_SCOPE AND t.owner.id <> :me " +
           "     AND k.status IN (com.kpitracking.enums.KpiStatus.APPROVED, com.kpitracking.enums.KpiStatus.EDIT, com.kpitracking.enums.KpiStatus.EDITED) " +
           "     AND EXISTS (SELECT 1 FROM OrgUnit su WHERE k.orgUnit.path LIKE CONCAT(su.path, '%') AND su.id IN :managerUnitIds)) OR " +
           "  (:view = 'KPI' AND (" + INVOLVED + " OR (:team = true AND t.visibility = com.kpitracking.enums.KpiTaskVisibility.KPI_SCOPE)))" +
           ") " +
           "AND (:kpiId IS NULL OR t.kpiCriteriaId = :kpiId) " +
           "AND (:periodId IS NULL OR k.kpiPeriod.id = :periodId) " +
           "AND (:ownerId IS NULL OR t.owner.id = :ownerId) " +
           "AND (:priority IS NULL OR t.priority = :priority) " +
           "AND (:topLevel = false OR t.parentTaskId IS NULL) " +
           "AND (:noDue = false OR t.dueDate IS NULL) " +
           "AND (cast(:dueFrom as date) IS NULL OR t.dueDate >= :dueFrom) " +
           "AND (cast(:dueTo as date) IS NULL OR t.dueDate <= :dueTo) " +
           "AND (:overdue = false OR ((t.dueDate < :today OR (t.dueDate = :today AND t.dueTime IS NOT NULL AND t.dueTime < :nowTime)) " +
           "     AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS))) " +
           "AND (:keyword IS NULL OR LOWER(t.title) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    Page<KpiTask> findView(@Param("view") String view,
                           @Param("me") UUID me,
                           @Param("team") boolean team,
                           @Param("managerUnitIds") Collection<UUID> managerUnitIds,
                           @Param("statuses") Collection<KpiTaskStatus> statuses,
                           @Param("kpiId") UUID kpiId,
                           @Param("periodId") UUID periodId,
                           @Param("ownerId") UUID ownerId,
                           @Param("priority") KpiTaskPriority priority,
                           @Param("topLevel") boolean topLevel,
                           @Param("noDue") boolean noDue,
                           @Param("dueFrom") LocalDate dueFrom,
                           @Param("dueTo") LocalDate dueTo,
                           @Param("overdue") boolean overdue,
                           @Param("today") LocalDate today,
                           @Param("nowTime") LocalTime nowTime,
                           @Param("keyword") String keyword,
                           Pageable pageable);

    /**
     * Tiến độ việc (chỉ việc CẤP CAO NHẤT — việc con đã tính trong việc cha) theo KPI cho người xem:
     * [kpi_id, done, total (không tính huỷ), overdue]. Thấy: việc mình liên quan, và (nếu {@code team}) việc công khai.
     */
    @Query(value = "SELECT t.kpi_criteria_id, " +
            "  COUNT(*) FILTER (WHERE t.status = 'DONE'), " +
            "  COUNT(*) FILTER (WHERE t.status <> 'CANCELLED'), " +
            "  COUNT(*) FILTER (WHERE t.status IN ('TODO', 'IN_PROGRESS') AND t.due_date < :today) " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.parent_task_id IS NULL AND t.kpi_criteria_id IN (:kpiIds) " +
            "  AND (t.owner_id = :viewerId OR t.created_by = :viewerId " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :viewerId) " +
            "       OR (:team AND t.visibility = 'KPI_SCOPE')) " +
            "GROUP BY t.kpi_criteria_id", nativeQuery = true)
    List<Object[]> progressFor(@Param("kpiIds") Collection<UUID> kpiIds, @Param("viewerId") UUID viewerId,
                               @Param("team") boolean team, @Param("today") LocalDate today);

    @Query("SELECT t FROM KpiTask t WHERE t.parentTaskId = :parentId ORDER BY t.sortOrder, t.createdAt")
    List<KpiTask> findSubtasks(@Param("parentId") UUID parentId);

    /** Tiến độ việc con theo task cha: [parent_id, done, total (không tính huỷ)]. */
    @Query(value = "SELECT t.parent_task_id, COUNT(*) FILTER (WHERE t.status = 'DONE'), COUNT(*) FILTER (WHERE t.status <> 'CANCELLED') " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.parent_task_id IN (:parentIds) GROUP BY t.parent_task_id",
            nativeQuery = true)
    List<Object[]> subtaskProgress(@Param("parentIds") Collection<UUID> parentIds);

    @Query("SELECT COUNT(t) FROM KpiTask t WHERE t.parentTaskId = :parentId " +
           "AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS)")
    long countOpenSubtasks(@Param("parentId") UUID parentId);

    @Query("SELECT COALESCE(MAX(t.sortOrder), 0) FROM KpiTask t WHERE t.owner.id = :ownerId AND t.status = :status")
    double maxSortOrder(@Param("ownerId") UUID ownerId, @Param("status") KpiTaskStatus status);

    @Query("SELECT t FROM KpiTask t WHERE t.owner.id = :ownerId AND t.kpiCriteriaId = :kpiId " +
           "AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS)")
    List<KpiTask> findOpenByOwnerAndKpi(@Param("ownerId") UUID ownerId, @Param("kpiId") UUID kpiId);

    // ── Chuỗi lặp ─────────────────────────────────────────────────────────────────────────────

    boolean existsBySeriesIdAndSeriesIndex(UUID seriesId, Integer seriesIndex);

    /** Các lần CHƯA XONG của chuỗi từ lần {@code fromIndex} trở đi — "lần này và các lần sau". */
    @Query("SELECT t FROM KpiTask t WHERE t.seriesId = :seriesId AND t.seriesIndex >= :fromIndex " +
           "AND t.status IN (com.kpitracking.enums.KpiTaskStatus.TODO, com.kpitracking.enums.KpiTaskStatus.IN_PROGRESS)")
    List<KpiTask> findOpenInSeriesFrom(@Param("seriesId") UUID seriesId, @Param("fromIndex") int fromIndex);

    // ── Đếm cho cột trái + huy hiệu ─────────────────────────────────────────────────────────────

    /** Số việc CHƯA XONG theo chế độ xem: [assigned, following, created, delegated, involved]. */
    @Query(value = "SELECT " +
            "  COUNT(*) FILTER (WHERE t.owner_id = :me), " +
            "  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me)), " +
            "  COUNT(*) FILTER (WHERE t.created_by = :me), " +
            "  COUNT(*) FILTER (WHERE t.created_by = :me AND t.owner_id <> :me), " +
            "  COUNT(*) " +
            "FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') " +
            "  AND (t.owner_id = :me OR t.created_by = :me " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))",
            nativeQuery = true)
    List<Object[]> viewCounts(@Param("me") UUID me);

    /** Huy hiệu menu: việc tôi phụ trách, chưa xong, đã quá hạn hoặc tới hạn hôm nay. */
    @Query(value = "SELECT COUNT(*) FROM kpi_tasks t WHERE t.deleted_at IS NULL AND t.owner_id = :me " +
            "AND t.status IN ('TODO', 'IN_PROGRESS') AND t.due_date <= :today", nativeQuery = true)
    long badgeCount(@Param("me") UUID me, @Param("today") LocalDate today);

    /**
     * KPI của tôi (tạo hoặc thực hiện, còn nhận việc) trong đợt đang diễn ra, kèm số việc chưa xong tôi liên quan:
     * [kpi_id, kpi_name, open_count]. Không có đợt nào đang diễn ra thì trả rỗng — giao diện dùng bộ lọc đợt.
     */
    @Query(value = "SELECT k.id, k.name, " +
            "  (SELECT COUNT(*) FROM kpi_tasks t WHERE t.kpi_criteria_id = k.id AND t.deleted_at IS NULL " +
            "     AND t.status IN ('TODO', 'IN_PROGRESS') AND (t.owner_id = :me OR t.created_by = :me " +
            "     OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me))) " +
            "FROM kpi_criteria k JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "WHERE k.deleted_at IS NULL AND p.deleted_at IS NULL " +
            "  AND k.status IN ('DRAFT', 'PENDING_APPROVAL', 'EDIT', 'EDITED', 'APPROVED', 'REJECTED') " +
            "  AND p.start_date <= :now AND p.end_date >= :now " +
            "  AND (k.created_by = :me OR EXISTS (SELECT 1 FROM kpi_criteria_assignees a WHERE a.kpi_criteria_id = k.id AND a.user_id = :me)) " +
            "ORDER BY k.name", nativeQuery = true)
    List<Object[]> myCurrentKpis(@Param("me") UUID me, @Param("now") Instant now);

    // ── Ô chọn người / KPI khi giao việc ────────────────────────────────────────────────────────

    /**
     * Người mình được giao việc: người thuộc đơn vị mình là trưởng/phó (rank ≤ 1) hoặc đơn vị con; quản trị viên
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

    /** Số việc chưa xong theo từng người trên một KPI. Trả về [owner_id, count]. */
    @Query(value = "SELECT owner_id, COUNT(*) FROM kpi_tasks WHERE kpi_criteria_id = :kpiId AND deleted_at IS NULL " +
            "AND status IN ('TODO', 'IN_PROGRESS') GROUP BY owner_id", nativeQuery = true)
    List<Object[]> countOpenByOwner(@Param("kpiId") UUID kpiId);

    // ── Nhắc quá hạn ────────────────────────────────────────────────────────────────────────────

    /**
     * Việc chưa xong ĐÃ QUÁ HẠN, chưa nhắc quá hạn: hạn trước hôm nay, hoặc hôm nay mà giờ hạn đã qua. Người phụ trách
     * còn hoạt động, KPI chưa xoá, kỳ chưa khoá.
     */
    @Query(value = "SELECT t.* FROM kpi_tasks t " +
            "JOIN users u ON u.id = t.owner_id AND u.deleted_at IS NULL AND u.status = 'ACTIVE' " +
            "JOIN kpi_criteria k ON k.id = t.kpi_criteria_id AND k.deleted_at IS NULL AND k.status <> 'CLOSED_BY_LOCK' " +
            "LEFT JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "LEFT JOIN kpi_cycles c ON c.id = p.kpi_cycle_id " +
            "WHERE t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') AND t.reminded_overdue_at IS NULL " +
            "  AND (c.status IS NULL OR c.status <> 'LOCKED') " +
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
}
