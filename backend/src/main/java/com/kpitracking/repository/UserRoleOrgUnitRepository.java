package com.kpitracking.repository;


import com.kpitracking.entity.UserRoleOrgUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserRoleOrgUnitRepository extends JpaRepository<UserRoleOrgUnit, UserRoleOrgUnit.UserRoleOrgUnitId> {

    boolean existsByOrgUnitId(UUID orgUnitId);
    boolean existsByOrgUnitIdAndRoleId(UUID orgUnitId, UUID roleId);
    boolean existsByRoleId(UUID roleId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.role JOIN FETCH uro.orgUnit ou JOIN FETCH ou.orgHierarchyLevel WHERE uro.user.id = :userId ORDER BY uro.role.rank ASC, ou.path ASC")
    List<UserRoleOrgUnit> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.user.id IN :userIds")
    List<UserRoleOrgUnit> findByUserIdIn(@Param("userIds") java.util.Collection<UUID> userIds);

    /** Như findByUserIdIn nhưng nạp kèm đơn vị + CẤP đơn vị (để lọc theo cấp/loại đơn vị mà không N+1). */
    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role JOIN FETCH uro.orgUnit ou JOIN FETCH ou.orgHierarchyLevel WHERE uro.user.id IN :userIds")
    List<UserRoleOrgUnit> findByUserIdInWithUnit(@Param("userIds") java.util.Collection<UUID> userIds);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.role WHERE uro.user.id = :userId AND uro.orgUnit.id = :orgUnitId")
    List<UserRoleOrgUnit> findByUserIdAndOrgUnitId(@Param("userId") UUID userId, @Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId")
    List<UserRoleOrgUnit> findByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role JOIN FETCH uro.orgUnit ou JOIN FETCH ou.orgHierarchyLevel WHERE ou.id IN :orgUnitIds")
    List<UserRoleOrgUnit> findByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank <= 1")
    List<UserRoleOrgUnit> findManagersByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    void deleteByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);

    void deleteByUserIdInAndOrgUnitId(List<UUID> userIds, UUID orgUnitId);

    void deleteByOrgUnitId(UUID orgUnitId);

    void deleteByUserId(UUID userId);
    
    void deleteByOrgUnitIdAndRoleId(UUID orgUnitId, UUID roleId);

    boolean existsByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);

    @Query("SELECT CASE WHEN COUNT(uro) > 0 THEN true ELSE false END FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId AND uro.role.name = :roleName")
    boolean existsByOrgUnitIdAndRoleName(@Param("orgUnitId") UUID orgUnitId, @Param("roleName") String roleName);

    @Query("SELECT CASE WHEN COUNT(uro) > 0 THEN true ELSE false END FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId AND uro.role.name = :roleName AND uro.user.id <> :excludeUserId")
    boolean existsByOrgUnitIdAndRoleNameAndUserIdNot(@Param("orgUnitId") UUID orgUnitId, @Param("roleName") String roleName, @Param("excludeUserId") UUID excludeUserId);

    @Query("SELECT CASE WHEN COUNT(uro) > 0 THEN true ELSE false END FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank = :rank")
    boolean existsByOrgUnitIdAndRoleRank(@Param("orgUnitId") UUID orgUnitId, @Param("rank") Integer rank);

    @Query("SELECT CASE WHEN COUNT(uro) > 0 THEN true ELSE false END FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank = :rank AND uro.user.id <> :excludeUserId")
    boolean existsByOrgUnitIdAndRoleRankAndUserIdNot(@Param("orgUnitId") UUID orgUnitId, @Param("rank") Integer rank, @Param("excludeUserId") UUID excludeUserId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank = :rank")
    List<UserRoleOrgUnit> findByOrgUnitIdAndRoleRank(@Param("orgUnitId") UUID orgUnitId, @Param("rank") Integer rank);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank = :rank AND uro.user.id <> :excludeUserId")
    List<UserRoleOrgUnit> findByOrgUnitIdAndRoleRankAndUserIdNot(@Param("orgUnitId") UUID orgUnitId, @Param("rank") Integer rank, @Param("excludeUserId") UUID excludeUserId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countUsersByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    List<com.kpitracking.entity.User> findUsersByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId")
    long countUsersByOrganizationUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId AND uro.orgUnit.path LIKE CONCAT(:pathPrefix, '%')")
    long countUsersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("orgId") UUID orgId);

    @Query(value = "SELECT r.name, COUNT(DISTINCT uro.user_id) " +
            "FROM user_role_org_units uro " +
            "JOIN roles r ON uro.role_id = r.id " +
            "JOIN org_units ou ON uro.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE ohl.organization_id = :orgId " +
            "AND ou.path LIKE CONCAT(:pathPrefix, '%') " +
            "GROUP BY r.name", nativeQuery = true)
    java.util.List<Object[]> findRoleDistributionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("orgId") UUID orgId);
    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id IN :orgUnitIds")
    long countUsersByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId AND uro.orgUnit.path LIKE :path")
    List<com.kpitracking.entity.User> findUsersByOrgUnitPath(@Param("path") String path, @Param("orgId") UUID orgId);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro JOIN com.kpitracking.entity.RolePermission rp ON rp.role = uro.role JOIN rp.permission perm WHERE uro.orgUnit.id = :orgUnitId AND perm.code = :permissionCode")
    List<com.kpitracking.entity.User> findUsersWithPermissionInOrgUnit(@Param("orgUnitId") UUID orgUnitId, @Param("permissionCode") String permissionCode);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro JOIN com.kpitracking.entity.RolePermission rp ON rp.role = uro.role JOIN rp.permission perm WHERE LOCATE(uro.orgUnit.path, :targetPath) = 1 AND perm.code = :permissionCode")
    List<com.kpitracking.entity.User> findUsersWithPermissionOverOrgUnit(@Param("targetPath") String targetPath, @Param("permissionCode") String permissionCode);

    @Query("SELECT uro.orgUnit.id, COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id IN :orgUnitIds GROUP BY uro.orgUnit.id")
    List<Object[]> countUsersByOrgUnitIdMap(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT DISTINCT r FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.orgUnit.id IN :orgUnitIds")
    List<com.kpitracking.entity.Role> findDistinctRolesByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    /**
     * Danh sách nhân sự cho màn phân bổ hạn mức token, có phân trang và lọc.
     *
     * <p>{@code paths = null} nghĩa là không giới hạn subtree (quản lý cao nhất, thấy cả công ty);
     * truyền tập đường dẫn thì chỉ lấy người trong subtree đó.
     *
     * <p>Bộ lọc trạng thái phải dùng truy vấn con vô hướng chứ không JOIN được, vì
     * {@code AiTokenQuota.userId} là cột UUID trần, không khai liên kết tới {@code User}.
     */
    @Query(value = "SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro " +
           "WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId AND uro.user.deletedAt IS NULL " +
           "AND (:paths IS NULL OR EXISTS (SELECT 1 FROM OrgUnit p " +
           "     WHERE uro.orgUnit.path LIKE CONCAT(p.path, '%') AND p.path IN :paths)) " +
           "AND (:keyword IS NULL OR :keyword = '' " +
           "     OR LOWER(CAST(uro.user.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(CAST(uro.user.email AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) " +
           "AND (:roleName IS NULL OR :roleName = '' OR uro.role.name = :roleName) " +
           "AND (:status IS NULL OR :status = '' " +
           "     OR (:status = 'UNALLOCATED' AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) = 0L) " +
           "     OR (:status = 'ALLOCATED' AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) > 0L) " +
           "     OR (:status = 'NEAR_LIMIT' " +
           "         AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) > 0L " +
           "         AND (SELECT COALESCE(SUM(t.totalTokens), 0) FROM AiTokenUsage t " +
           "              WHERE t.userId = uro.user.id AND t.periodMonth = :period) " +
           "             >= 0.8 * COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L)))",
           countQuery = "SELECT COUNT(DISTINCT uro.user) FROM UserRoleOrgUnit uro " +
           "WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId AND uro.user.deletedAt IS NULL " +
           "AND (:paths IS NULL OR EXISTS (SELECT 1 FROM OrgUnit p " +
           "     WHERE uro.orgUnit.path LIKE CONCAT(p.path, '%') AND p.path IN :paths)) " +
           "AND (:keyword IS NULL OR :keyword = '' " +
           "     OR LOWER(CAST(uro.user.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(CAST(uro.user.email AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) " +
           "AND (:roleName IS NULL OR :roleName = '' OR uro.role.name = :roleName) " +
           "AND (:status IS NULL OR :status = '' " +
           "     OR (:status = 'UNALLOCATED' AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) = 0L) " +
           "     OR (:status = 'ALLOCATED' AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) > 0L) " +
           "     OR (:status = 'NEAR_LIMIT' " +
           "         AND COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L) > 0L " +
           "         AND (SELECT COALESCE(SUM(t.totalTokens), 0) FROM AiTokenUsage t " +
           "              WHERE t.userId = uro.user.id AND t.periodMonth = :period) " +
           "             >= 0.8 * COALESCE((SELECT q.monthlyLimit FROM AiTokenQuota q WHERE q.userId = uro.user.id), 0L)))")
    org.springframework.data.domain.Page<com.kpitracking.entity.User> searchAllocatableUsers(
            @Param("orgId") UUID orgId,
            @Param("paths") java.util.Collection<String> paths,
            @Param("keyword") String keyword,
            @Param("roleName") String roleName,
            @Param("status") String status,
            @Param("period") java.time.LocalDate period,
            org.springframework.data.domain.Pageable pageable);

    /** Các vai trò thực sự có mặt trong phạm vi — đổ vào ô lọc, không hiện vai trò rỗng người. */
    @Query("SELECT DISTINCT uro.role.name FROM UserRoleOrgUnit uro " +
           "WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId AND uro.user.deletedAt IS NULL " +
           "AND (:paths IS NULL OR EXISTS (SELECT 1 FROM OrgUnit p " +
           "     WHERE uro.orgUnit.path LIKE CONCAT(p.path, '%') AND p.path IN :paths)) " +
           "ORDER BY uro.role.name")
    List<String> findRoleNamesInScope(@Param("orgId") UUID orgId,
                                      @Param("paths") java.util.Collection<String> paths);
}
