package com.kpitracking.repository;

import com.kpitracking.entity.Scope;
import com.kpitracking.enums.ScopeCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ScopeRepository extends JpaRepository<Scope, UUID> {

    Optional<Scope> findByCode(ScopeCode code);
}
