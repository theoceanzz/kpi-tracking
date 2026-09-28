package com.kpitracking.repository;

import com.kpitracking.entity.F360Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface F360QuestionRepository extends JpaRepository<F360Question, UUID> {

    @Query("SELECT q FROM F360Question q LEFT JOIN FETCH q.competency WHERE q.template.id = :templateId ORDER BY q.position ASC")
    List<F360Question> findByTemplateIdWithCompetency(@Param("templateId") UUID templateId);
}
