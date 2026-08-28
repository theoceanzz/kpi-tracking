package com.kpitracking.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a JOIN FETCH k.kpiPeriod " +
           "LEFT JOIN FETCH k.keyResult kr LEFT JOIN FETCH kr.objective obj WHERE " +
           "k.orgUnit.orgHierarchyLevel.organization.id = :organizationId AND " +
           "(" +
           "  k.createdBy.id = :currentUserId OR " +
           "  EXISTS (SELECT 1 FROM k.assignees sa WHERE sa.id = :currentUserId) OR " +
           "  ((EXISTS (SELECT 1 FROM OrgUnit su WHERE k.orgUnit.path LIKE CONCAT(su.path, '%') AND su.id IN :managerUnitIds) OR k.orgUnit.id IN :memberUnitIds) AND (:approvalMode = true OR k.status = com.kpitracking.enums.KpiStatus.APPROVED))" +
           ") AND " +
           "(:createdById IS NULL OR k.createdBy.id = :createdById) AND " +
           "(:assigneeId IS NULL OR a.id = :assigneeId) AND " +
           "(:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND " +
           "(:keyword IS NULL OR :keyword = '' " +
           "OR LOWER(CAST(k.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(k.orgUnit.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.employeeCode AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND " +
           "(cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate) AND " +
           "(:objectiveId IS NULL OR k.keyResult.objective.id = :objectiveId) AND " +
           "(:keyResultId IS NULL OR k.keyResult.id = :keyResultId) AND " +
           "(:perspectiveId IS NULL OR k.perspective.id = :perspectiveId) AND " +
           "(:kpiNature IS NULL OR " +
           "  (:kpiNature = 'PARENT_CHILD' AND (k.parent IS NOT NULL OR EXISTS (SELECT 1 FROM KpiCriteria c2 WHERE c2.parent = k))) OR " +
           "  (:kpiNature = 'STANDALONE' AND k.parent IS NULL AND NOT EXISTS (SELECT 1 FROM KpiCriteria c3 WHERE c3.parent = k))" +
           ") AND " +
           "(:isBonusKpi IS NULL OR k.isBonusKpi = :isBonusKpi) AND " +
           "(:isReverseKpi IS NULL OR k.isReverseKpi = :isReverseKpi) AND " +
           "(:kpiType IS NULL OR k.kpiType = :kpiType)")
    Page<KpiCriteria> findAllWithFilters(
            @Param("organizationId") UUID organizationId,
            @Param("currentUserId") UUID currentUserId,
            @Param("managerUnitIds") Collection<UUID> managerUnitIds,
            @Param("memberUnitIds") Collection<UUID> memberUnitIds,
            @Param("approvalMode") boolean approvalMode,
            @Param("createdById") UUID createdById,
            @Param("assigneeId") UUID assigneeId,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("status") KpiStatus status,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("keyword") String keyword,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("objectiveId") UUID objectiveId,
            @Param("keyResultId") UUID keyResultId,
            @Param("perspectiveId") UUID perspectiveId,
            @Param("kpiNature") String kpiNature,
            @Param("isBonusKpi") Boolean isBonusKpi,
            @Param("isReverseKpi") Boolean isReverseKpi,
            @Param("kpiType") com.kpitracking.enums.KpiType kpiType,
            Pageable pageable
    );

    List<KpiCriteria> findByKpiPeriodIdAndStatusIn(UUID kpiPeriodId, List<KpiStatus> statuses);

    @Query("SELECT k FROM KpiCriteria k WHERE k.perspective IS NOT NULL AND k.keyResult IS NULL " +
           "AND k.orgUnit.orgHierarchyLevel.organization.id = :organizationId")
    List<KpiCriteria> findByOrganizationIdAndPerspectiveNotNullAndKeyResultIsNull(@Param("organizationId") UUID organizationId);

    Page<KpiCriteria> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<KpiCriteria> findByStatus(KpiStatus status, Pageable pageable);

    List<KpiCriteria> findByStatus(KpiStatus status);

    Page<KpiCriteria> findByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById")
    Page<KpiCriteria> findByCreatedById(@Param("createdById") UUID createdById, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndStatus(@Param("createdById") UUID createdById, @Param("status") KpiStatus status, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitId(@Param("createdById") UUID createdById, @Param("orgUnitId") UUID orgUnitId, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitIdAndStatus(@Param("createdById") UUID createdById, @Param("orgUnitId") UUID orgUnitId, @Param("status") KpiStatus status, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a WHERE a.id = :userId OR k.createdBy.id = :userId")
    Page<KpiCriteria> findByUserIdInAssigneesOrCreatedBy(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssignees(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND (cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate)")
    Page<KpiCriteria> findByUserIdInAssigneesWithDate(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses, 
                                                     @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodId(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND (cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate)")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodIdWithDate(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses, 
                                                                   @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    long countByOrgUnitIdIn(Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(Collection<UUID> orgUnitIds, KpiStatus status);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status AND k.createdBy.id != :excludeUserId")
    long countByOrgUnitIdInAndStatusExcludingUser(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("status") KpiStatus status, @Param("excludeUserId") UUID excludeUserId);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE " +
           "k.orgUnit.orgHierarchyLevel.organization.id = :organizationId AND " +
           "k.status = com.kpitracking.enums.KpiStatus.PENDING_APPROVAL AND " +
           "(EXISTS (SELECT 1 FROM OrgUnit su WHERE k.orgUnit.path LIKE CONCAT(su.path, '%') AND su.id IN :managerUnitIds) OR k.orgUnit.id IN :memberUnitIds) AND " +
           "(:excludeUserId IS NULL OR k.createdBy.id != :excludeUserId) AND " +
           "(:kpiType IS NULL OR k.kpiType = :kpiType)")
    long countPendingApprovalVisibleTo(@Param("organizationId") UUID organizationId,
                                       @Param("managerUnitIds") Collection<UUID> managerUnitIds,
                                       @Param("memberUnitIds") Collection<UUID> memberUnitIds,
                                       @Param("excludeUserId") UUID excludeUserId,
                                       @Param("kpiType") com.kpitracking.enums.KpiType kpiType);

    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE k.orgUnit.id = :orgUnitId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(@Param("orgUnitId") UUID orgUnitId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);
    
    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE (:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitPathAndKpiPeriodIdAndStatusIn(@Param("orgUnitPath") String orgUnitPath, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    long countByAssigneeAndStatusIn(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = :status")
    long countByAssigneeAndStatus(@Param("userId") UUID userId, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@Param("path") String path);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path AND k.status = :status")
    long countByOrgUnitPathAndStatus(@Param("path") String path, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(DISTINCT k.orgUnit.id) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.orgUnit.parent IS NOT NULL")
    long countDistinctOrgUnitsWithKpiIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds);

     @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.keyResult IS NOT NULL")
    List<KpiCriteria> findApprovedByAssigneeIdWithKeyResult(@Param("userId") UUID userId);

    @Query("SELECT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.keyResult IS NULL")
    List<KpiCriteria> findApprovedByAssigneeIdWithoutKeyResult(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.createdAt >= :from AND k.createdAt <= :to")
    List<KpiCriteria> findApprovedByAssigneeIdAndPeriod(@Param("userId") UUID userId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    long countByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(DISTINCT uro.orgUnit.id) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses AND uro.orgUnit.parent IS NOT NULL")
    long countDistinctOrgUnitsOfAssigneesIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses")
    long countTotalKpiCriteriaIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT CONCAT(CAST(k.id AS string), '_', CAST(a.id AS string))) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses")
    long countTotalAssignmentsIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    List<KpiCriteria> findByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);

    @Query(value = "SELECT COUNT(k.id) FROM kpi_criteria k " +
            "JOIN org_units ou ON k.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND k.deleted_at IS NULL " +
            "AND k.created_at >= :startDate AND k.created_at <= :endDate", nativeQuery = true)
    long countInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    // "Chưa nộp" = KPI ĐÃ DUYỆT (status=APPROVED — nháp/chờ duyệt không tính), gắn cho người đó,
    // thuộc các ĐỢT phủ khoảng thời gian (periodIds), mà người đó CHƯA hề có bài nộp nào còn hiệu lực.
    // ĐÃ NỘP thì thôi — KHÔNG xét tiến độ/hoàn thành, KHÔNG ràng buộc NGÀY nộp: bài nộp đã gắn với KPI
    // của đúng đợt rồi; ràng ngày nộp từng làm SÓT bài nộp cùng ngày (end resolve về đầu ngày).
    @Query(value = "SELECT u.id, u.full_name, u.email, COUNT(ka.kpi_criteria_id) AS missing_count " +
            "FROM kpi_criteria_assignees ka " +
            "JOIN users u ON ka.user_id = u.id " +
            "JOIN kpi_criteria k ON ka.kpi_criteria_id = k.id " +
            "JOIN org_units ou ON k.org_unit_id = ou.id " +
            "LEFT JOIN kpi_submissions s ON s.kpi_criteria_id = k.id AND s.submitted_by = u.id AND s.deleted_at IS NULL " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND k.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND k.status = 'APPROVED' " +
            "AND k.kpi_period_id IN (:periodIds) " +
            "AND s.id IS NULL " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY missing_count DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopNonSubmittersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("periodIds") java.util.Collection<UUID> periodIds, @Param("limit") int limit);

    // Bản theo CẶP (chỉ tiêu, người) của truy vấn ngay trên: cùng định nghĩa "chưa nộp", chỉ khác ở
    // chỗ KHÔNG gộp. Cần vì việc nhắc nhở gửi theo từng chỉ tiêu một
    // (ReminderService.sendReminder(kpiCriteriaId, userId)), nên bản gộp theo người không đủ dữ liệu.
    // Giữ y nguyên mệnh đề WHERE để hai bên không thể trôi lệch định nghĩa.
    @Query(value = "SELECT k.id, k.name, u.id, u.full_name " +
            "FROM kpi_criteria_assignees ka " +
            "JOIN users u ON ka.user_id = u.id " +
            "JOIN kpi_criteria k ON ka.kpi_criteria_id = k.id " +
            "JOIN org_units ou ON k.org_unit_id = ou.id " +
            "LEFT JOIN kpi_submissions s ON s.kpi_criteria_id = k.id AND s.submitted_by = u.id AND s.deleted_at IS NULL " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND k.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND k.status = 'APPROVED' " +
            "AND k.kpi_period_id IN (:periodIds) " +
            "AND s.id IS NULL " +
            "ORDER BY u.full_name, k.name LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findMissingSubmissionPairsInSubtree(@Param("pathPrefix") String pathPrefix, @Param("periodIds") java.util.Collection<UUID> periodIds, @Param("limit") int limit);
    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses AND k.isBonusKpi = false " +
           "AND NOT EXISTS (SELECT 1 FROM KpiCriteria c WHERE c.parent = k AND c.parentRelationType = com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)")
    Double sumWeightByUserIdAndKpiPeriodIdAndStatusIn(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.orgUnit.id = :orgUnitId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses AND k.isBonusKpi = false " +
           "AND NOT EXISTS (SELECT 1 FROM KpiCriteria c WHERE c.parent = k AND c.parentRelationType = com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)")
    Double sumWeightByUserIdAndOrgUnitIdAndKpiPeriodIdAndStatusIn(@Param("userId") UUID userId, @Param("orgUnitId") UUID orgUnitId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a JOIN FETCH k.kpiPeriod " +
           "LEFT JOIN FETCH k.keyResult kr LEFT JOIN FETCH kr.objective obj WHERE " +
           "k.orgUnit.orgHierarchyLevel.organization.id = :organizationId AND " +
           "(a.id = :userId OR k.createdBy.id = :userId) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:statuses IS NULL OR k.status IN :statuses) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND " +
           "(cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate) AND " +
           "(:objectiveId IS NULL OR k.keyResult.objective.id = :objectiveId) AND " +
           "(:keyResultId IS NULL OR k.keyResult.id = :keyResultId)")
    Page<KpiCriteria> findMyWithFilters(
            @Param("organizationId") UUID organizationId,
            @Param("userId") UUID userId,
            @Param("status") KpiStatus status,
            @Param("statuses") Collection<KpiStatus> statuses,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("objectiveId") UUID objectiveId,
            @Param("keyResultId") UUID keyResultId,
            Pageable pageable
    );

    List<KpiCriteria> findByParentId(UUID parentId);

    boolean existsByParentAndAssigneesContains(com.kpitracking.entity.KpiCriteria parent, com.kpitracking.entity.User assignee);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id = :orgUnitId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    List<KpiCriteria> findByOrgUnitIdAndKpiPeriodIdAndStatusIn(@Param("orgUnitId") UUID orgUnitId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.keyResult IS NULL AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedWithoutKeyResultByOrgUnitIds(@Param("orgUnitIds") List<UUID> orgUnitIds);

    /** MỌI KPI approved của (các) đơn vị — dùng cho analytics "KPI đơn vị" khi org TẮT OKR (KPI gắn KeyResult vẫn tính). */
    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedByOrgUnitIds(@Param("orgUnitIds") List<UUID> orgUnitIds);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(CAST(k.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) " +
           // Khớp CHÍNH XÁC lên đầu. Truy vấn này có LIMIT, mà khớp mờ "%tu khoa%" kéo về rất
           // nhiều dòng — không sắp thứ tự thì đúng cái tên người dùng gõ có thể bị cắt mất khỏi
           // trang đầu. Đo được: search(kpi, "a") trả 10 dòng KHÔNG có KPI nào tên "a", nên trợ lý
           // đi hỏi làm rõ về một KPI khác hẳn, còn tên người dùng vừa nêu thì biến mất.
           "ORDER BY CASE WHEN LOWER(CAST(k.name AS string)) = LOWER(CAST(:keyword AS string)) THEN 0 ELSE 1 END, k.name")
    List<KpiCriteria> searchByKeyword(@Param("orgId") UUID orgId, @Param("keyword") String keyword, Pageable pageable);
}
