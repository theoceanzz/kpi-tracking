package com.kpitracking.repository;

import com.kpitracking.entity.BscObjectiveRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscObjectiveRelationRepository extends JpaRepository<BscObjectiveRelation, UUID> {

    List<BscObjectiveRelation> findByOrganizationId(UUID organizationId);

    boolean existsByOrganizationIdAndSourceObjectiveIdAndTargetObjectiveId(
            UUID organizationId, UUID sourceObjectiveId, UUID targetObjectiveId);
}
