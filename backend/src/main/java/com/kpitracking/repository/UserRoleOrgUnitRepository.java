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

    boolean existsByUserIdAndRoleIdAndOrgUnitId(UUID userId, UUID roleId, UUID orgUnitId);
}
