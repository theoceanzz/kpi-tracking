package com.kpitracking.repository;

import com.kpitracking.entity.F360Competency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface F360CompetencyRepository extends JpaRepository<F360Competency, UUID> {

    List<F360Competency> findByTemplateIdOrderByPositionAsc(UUID templateId);
}
