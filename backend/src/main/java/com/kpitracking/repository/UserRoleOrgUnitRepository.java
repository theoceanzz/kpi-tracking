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

    @Query("SELECT uro.orgUnit.id, COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id IN :orgUnitIds GROUP BY uro.orgUnit.id")
    List<Object[]> countUsersByOrgUnitIdMap(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT DISTINCT r FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.orgUnit.id IN :orgUnitIds")
    List<com.kpitracking.entity.Role> findDistinctRolesByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);
}