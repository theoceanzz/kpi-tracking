package com.kpitracking.repository;

import com.kpitracking.entity.Evaluation;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {

    Page<Evaluation> findByUserId(UUID userId, Pageable pageable);

    Page<Evaluation> findByKpiPeriodId(UUID kpiPeriodId, Pageable pageable);

    Page<Evaluation> findByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId, Pageable pageable);
    java.util.List<Evaluation> findByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId);

    @Query("SELECT e FROM Evaluation e WHERE " +
           "(e.user.id = :currentUserId OR e.evaluator.id = :currentUserId OR EXISTS (SELECT 1 FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND EXISTS (SELECT 1 FROM OrgUnit au_perm WHERE uro_sub.orgUnit.path LIKE CONCAT(au_perm.path, '%') AND au_perm.id IN :allowedOrgUnitIds)) OR EXISTS (SELECT 1 FROM OrgUnit au WHERE e.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:userId IS NULL OR e.user.id = :userId) AND " +
           "(:kpiPeriodId IS NULL OR e.kpiPeriod.id = :kpiPeriodId) AND " +
           "(:orgUnitPath IS NULL OR e.orgUnit.path LIKE :orgUnitPath) AND " +
           "(:evaluatorId IS NULL OR e.evaluator.id = :evaluatorId) AND " +
           "(:currentUserRank IS NULL OR :currentUserLevel = 0 OR e.user.id = :currentUserId OR e.evaluator.id = :currentUserId OR " +
           "(SELECT MIN(COALESCE(uro_sub.role.level, 4)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) > :currentUserLevel OR " +
           "((SELECT MIN(COALESCE(uro_sub.role.level, 4)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) = :currentUserLevel AND " +
           "(SELECT MIN(COALESCE(uro_sub.role.rank, 2)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) > :currentUserRank))")
    Page<Evaluation> findAllWithFilters(
            @Param("currentUserId") UUID currentUserId,
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("evaluatorId") UUID evaluatorId,
            @Param("currentUserRank") Integer currentUserRank,
            @Param("currentUserLevel") Integer currentUserLevel,
            Pageable pageable
    );

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id = :userId")
    Double avgScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId AND e.kpiPeriod.id = :kpiPeriodId AND e.evaluator.id = :evaluatorId")
    java.util.Optional<Evaluation> findByUserIdAndKpiPeriodIdAndEvaluatorId(
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("evaluatorId") UUID evaluatorId
    );

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@Param("path") String path);
    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    /** Số phiếu đánh giá tách theo ĐỢT (mới nhất trước) → [periodId, periodName, count]. */
    @Query("SELECT kp.id, kp.name, COUNT(e.id) " +
           "FROM Evaluation e JOIN e.kpiPeriod kp " +
           "WHERE e.orgUnit.id IN :orgUnitIds " +
           "GROUP BY kp.id, kp.name, kp.startDate ORDER BY kp.startDate DESC")
    java.util.List<Object[]> countGroupByPeriodForOrgUnits(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);
    // ===== Analytics queries =====

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findAllByUserIdOrdered(@Param("userId") UUID userId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId AND e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findByUserIdAndPeriod(@Param("userId") UUID userId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.id IN :orgUnitIds")
    Double avgScoreByOrgUnitIdIn(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds);

    // ===== Statistic Tool queries =====

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double avgScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double minScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double maxScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    long countAllByOrgId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT TO_CHAR(e.created_at, :pattern) AS period_label, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY period_label ORDER BY period_label", nativeQuery = true)
    java.util.List<Object[]> trendGroupByPeriodByOrgId(@Param("orgId") UUID orgId, @Param("pattern") String datePattern);

    @Query(value = "SELECT ou.id, ou.name, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND ou.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY ou.id, ou.name ORDER BY avg_score DESC", nativeQuery = true)
    java.util.List<Object[]> avgScoreGroupByOrgUnitByOrgId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> topPerformersByOrgId(@Param("orgId") UUID orgId, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> lowPerformersByOrgId(@Param("orgId") UUID orgId, @Param("limit") int limit);

    // ===== OrgUnit Subtree Statistics =====

    @Query(value = "SELECT AVG(e.score) FROM evaluations e " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate", nativeQuery = true)
    Double findAvgScoreInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopPerformersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowPerformersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Deprecated
    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double avgScoreAll();

    @Deprecated
    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double minScoreAll();

    @Deprecated
    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double maxScoreAll();

    @Deprecated
    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.deletedAt IS NULL")
    long countAll();

    @Deprecated
    @Query(value = "SELECT TO_CHAR(e.created_at, :pattern) AS period_label, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e WHERE e.deleted_at IS NULL " +
            "GROUP BY period_label ORDER BY period_label", nativeQuery = true)
    java.util.List<Object[]> trendGroupByPeriod(@Param("pattern") String datePattern);

    @Deprecated
    @Query(value = "SELECT ou.id, ou.name, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE e.deleted_at IS NULL AND ou.deleted_at IS NULL " +
            "GROUP BY ou.id, ou.name ORDER BY avg_score DESC", nativeQuery = true)
    java.util.List<Object[]> avgScoreGroupByOrgUnit();

    @Deprecated
    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> topPerformers(@Param("limit") int limit);

    @Deprecated
    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> lowPerformers(@Param("limit") int limit);

    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    Double minScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    Double maxScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    long countByUserId(@Param("userId") UUID userId);

    // ============================================================
    // Thống kê BSC (tab "Lĩnh vực"): gộp điểm bsc_score / system_score ĐÃ LƯU.
    // Evaluation có @SQLRestriction(deleted_at IS NULL) nên tự loại bản xoá mềm.
    // AVG bỏ NULL; COUNT(e.bscScore) = số đánh giá đã có điểm BSC.
    // ============================================================

    /** Tổng hợp toàn phạm vi → [avgBsc, avgSystem, evalCount, bscCount] (một dòng). */
    @Query("SELECT AVG(e.bscScore), AVG(e.systemScore), COUNT(e.id), COUNT(e.bscScore) " +
           "FROM Evaluation e WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds")
    java.util.List<Object[]> bscOverall(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                        @Param("periodIds") java.util.Collection<UUID> periodIds);

    /** Điểm BSC trung bình theo KỲ → [periodId, periodName, periodStart, avgBsc, count]. */
    @Query("SELECT kp.id, kp.name, kp.startDate, AVG(e.bscScore), COUNT(e.id) " +
           "FROM Evaluation e JOIN e.kpiPeriod kp " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY kp.id, kp.name, kp.startDate ORDER BY kp.startDate")
    java.util.List<Object[]> bscOverallByPeriod(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                                @Param("periodIds") java.util.Collection<UUID> periodIds);

    /** BSC vs hệ thống theo ĐƠN VỊ → [orgUnitId, orgUnitName, avgBsc, avgSystem, count]. */
    @Query("SELECT ou.id, ou.name, AVG(e.bscScore), AVG(e.systemScore), COUNT(e.id) " +
           "FROM Evaluation e JOIN e.orgUnit ou " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY ou.id, ou.name ORDER BY AVG(e.bscScore) DESC")
    java.util.List<Object[]> bscOverallByUnit(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                              @Param("periodIds") java.util.Collection<UUID> periodIds);

    /** BSC vs hệ thống theo NHÂN SỰ → [userId, fullName, email, avgBsc, avgSystem, count]. */
    @Query("SELECT u.id, u.fullName, u.email, AVG(e.bscScore), AVG(e.systemScore), COUNT(e.id) " +
           "FROM Evaluation e JOIN e.user u " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds AND u.deletedAt IS NULL " +
           "GROUP BY u.id, u.fullName, u.email")
    java.util.List<Object[]> bscOverallByUser(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                              @Param("periodIds") java.util.Collection<UUID> periodIds);

    // ============================================================
    // Thống kê MA TRẬN xếp loại (tab "Ma trận đánh giá"): gộp matrix_rating /
    // behavior_score / kpi_completion_percent ĐÃ LƯU. Chỉ tính đánh giá đã có xếp loại.
    // ============================================================

    /**
     * Từng đánh giá có xếp loại trong phạm vi, kèm chủ nhân và ngày bắt đầu đợt
     * → [userId, matrixRating, behaviorScore, kpiCompletionPercent, periodStart].
     *
     * <p>Cố ý trả về mức DÒNG chứ không gộp sẵn: ma trận phải đếm mỗi người một lần, mà gộp bằng
     * SQL rồi thì không lọc trùng người được nữa. Service rút gọn qua
     * {@code LatestEvaluationPicker} rồi mới tính trung bình, phân bố và ô heatmap — cả ba phải
     * đi từ CÙNG một danh sách, nếu không ba con số trên một khối sẽ không cộng khớp nhau.
     */
    @Query("SELECT e.user.id, e.matrixRating, e.behaviorScore, e.kpiCompletionPercent, p.startDate " +
           "FROM Evaluation e JOIN e.kpiPeriod p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds AND e.matrixRating IS NOT NULL")
    java.util.List<Object[]> matrixRows(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                        @Param("periodIds") java.util.Collection<UUID> periodIds);

    // ============================================================
    // Biểu đồ TƯƠNG QUAN (tab "Chuyên sâu"): giữ nguyên từng đánh giá thay vì gộp
    // vào ô heatmap, để vẽ được mỗi người một chấm.
    // ============================================================

    /**
     * Chấm phân tán hành vi × %HT kèm danh tính.
     * → [userId, fullName, orgUnitName, behaviorScore, kpiCompletionPercent, matrixRating].
     *
     * <p>Khác {@code matrixPairs} ở hai điểm: không lọc {@code matrixRating IS NOT NULL} (tổ chức
     * chưa cấu hình ma trận thì vẫn có chấm, chỉ là không tô màu được), và kéo theo danh tính để
     * tooltip hiện được tên — {@code matrixPairs} gộp hết vào ô heatmap nên mất dữ liệu cá nhân.
     */
    @Query("SELECT u.id, u.fullName, e.orgUnit.name, e.behaviorScore, e.kpiCompletionPercent, e.matrixRating, p.startDate " +
           "FROM Evaluation e JOIN e.user u JOIN e.kpiPeriod p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds AND u.deletedAt IS NULL " +
           "AND e.behaviorScore IS NOT NULL AND e.kpiCompletionPercent IS NOT NULL")
    java.util.List<Object[]> behaviorCompletionPoints(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                                      @Param("periodIds") java.util.Collection<UUID> periodIds);

    // ============================================================
    // Biểu đồ PHÂN PHỐI (tab Phân cấp / KPI đơn vị)
    // ============================================================

    /** Toàn bộ điểm đánh giá trong phạm vi — service tự chia khoảng (bin) cho histogram. */
    @Query("SELECT e.score FROM Evaluation e " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds AND e.score IS NOT NULL")
    java.util.List<Double> scoresInScope(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                         @Param("periodIds") java.util.Collection<UUID> periodIds);

    /**
     * Tứ phân vị điểm theo từng đơn vị — cho biểu đồ hộp.
     * → [orgUnitId, orgUnitName, min, q1, median, q3, max, count].
     *
     * <p>Dùng {@code percentile_cont} của PostgreSQL thay vì kéo toàn bộ bản ghi về rồi tính ở
     * Java: số đánh giá của một tổ chức lớn có thể lên hàng chục nghìn, mà kết quả cuối cùng chỉ
     * là 5 con số mỗi đơn vị.
     */
    @Query(value = "SELECT ou.id, ou.name, " +
            "MIN(e.score), " +
            "percentile_cont(0.25) WITHIN GROUP (ORDER BY e.score), " +
            "percentile_cont(0.5) WITHIN GROUP (ORDER BY e.score), " +
            "percentile_cont(0.75) WITHIN GROUP (ORDER BY e.score), " +
            "MAX(e.score), COUNT(*) " +
            "FROM evaluations e JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE e.org_unit_id IN (:unitIds) AND e.kpi_period_id IN (:periodIds) " +
            "AND e.deleted_at IS NULL AND e.score IS NOT NULL " +
            "GROUP BY ou.id, ou.name HAVING COUNT(*) > 0 ORDER BY ou.name", nativeQuery = true)
    java.util.List<Object[]> unitScoreQuartiles(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                                @Param("periodIds") java.util.Collection<UUID> periodIds);

    /** Điểm từng người kèm trung bình đơn vị — cho biểu đồ phân kỳ. → [userId, fullName, unitName, score]. */
    @Query("SELECT u.id, u.fullName, e.orgUnit.name, AVG(e.score) " +
           "FROM Evaluation e JOIN e.user u " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "AND e.score IS NOT NULL AND u.deletedAt IS NULL " +
           "GROUP BY u.id, u.fullName, e.orgUnit.name")
    java.util.List<Object[]> avgScoreByUser(@Param("unitIds") java.util.Collection<UUID> unitIds,
                                            @Param("periodIds") java.util.Collection<UUID> periodIds);
}
