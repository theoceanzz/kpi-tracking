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

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.role JOIN FETCH uro.orgUnit WHERE uro.user.id = :userId")
    List<UserRoleOrgUnit> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.role WHERE uro.user.id = :userId AND uro.orgUnit.id = :orgUnitId")
    List<UserRoleOrgUnit> findByUserIdAndOrgUnitId(@Param("userId") UUID userId, @Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId")
    List<UserRoleOrgUnit> findByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role JOIN FETCH uro.orgUnit ou JOIN FETCH ou.orgHierarchyLevel WHERE ou.id IN :orgUnitIds")
    List<UserRoleOrgUnit> findByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role WHERE uro.orgUnit.id = :orgUnitId AND uro.role.rank <= 1")
    List<UserRoleOrgUnit> findManagersByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    void deleteByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);

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

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id IN :orgUnitIds")
    long countUsersByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro WHERE uro.orgUnit.path LIKE :path")
    List<com.kpitracking.entity.User> findUsersByOrgUnitPath(@Param("path") String path);
}
