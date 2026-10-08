package com.kpitracking.repository;

import com.kpitracking.entity.ConductCriteriaGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConductCriteriaGroupRepository extends JpaRepository<ConductCriteriaGroup, UUID> {

    List<ConductCriteriaGroup> findByCriteriaSetIdOrderByPositionAsc(UUID criteriaSetId);
}
