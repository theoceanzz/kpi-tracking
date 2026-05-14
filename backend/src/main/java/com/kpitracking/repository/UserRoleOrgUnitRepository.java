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

    void deleteByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);
    
    void deleteByOrgUnitIdAndRoleId(UUID orgUnitId, UUID roleId);

    boolean existsByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countUsersByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT DISTINCT uro.user FROM UserRoleOrgUnit uro WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    List<com.kpitracking.entity.User> findUsersByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.id = :orgUnitId")
    long countUsersByOrganizationUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE uro.orgUnit.path LIKE CONCAT(:pathPrefix, '%')")
    long countUsersInSubtree(@Param("pathPrefix") String pathPrefix);

    @Query(value = "SELECT r.name, COUNT(DISTINCT uro.user_id) " +
            "FROM user_role_org_units uro " +
            "JOIN roles r ON uro.role_id = r.id " +
            "JOIN org_units ou ON uro.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') " +
            "GROUP BY r.name", nativeQuery = true)
    java.util.List<Object[]> findRoleDistributionInSubtree(@Param("pathPrefix") String pathPrefix);
}
