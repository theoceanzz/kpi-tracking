package com.kpitracking.repository;

import com.kpitracking.entity.Objective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ObjectiveRepository extends JpaRepository<Objective, UUID> {

    List<Objective> findByOrganizationId(UUID organizationId);

    @Query("SELECT DISTINCT o FROM Objective o JOIN o.orgUnits u WHERE u.id = :orgUnitId")
    List<Objective> findByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT DISTINCT o FROM Objective o JOIN o.orgUnits u WHERE u.id IN :orgUnitIds")
    List<Objective> findByOrgUnitIdIn(@Param("orgUnitIds") List<UUID> orgUnitIds);

    Optional<Objective> findByOrganizationIdAndCode(UUID organizationId, String code);

    boolean existsByOrganizationIdAndCode(UUID organizationId, String code);

    boolean existsByOrganizationIdAndCodeAndIdNot(UUID organizationId, String code, UUID id);
}
