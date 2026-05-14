package com.kpitracking.repository;

import com.kpitracking.entity.Objective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ObjectiveRepository extends JpaRepository<Objective, UUID> {
    List<Objective> findByOrganizationId(UUID organizationId);
    List<Objective> findByOrgUnitId(UUID orgUnitId);
    boolean existsByOrganizationIdAndCode(UUID organizationId, String code);
    boolean existsByOrganizationIdAndCodeAndIdNot(UUID organizationId, String code, UUID id);
}
