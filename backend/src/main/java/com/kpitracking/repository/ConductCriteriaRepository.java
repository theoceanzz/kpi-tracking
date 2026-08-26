package com.kpitracking.repository;

import com.kpitracking.entity.ConductCriteria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConductCriteriaRepository extends JpaRepository<ConductCriteria, UUID> {

    List<ConductCriteria> findByCriteriaSetIdOrderByPositionAsc(UUID criteriaSetId);

}
