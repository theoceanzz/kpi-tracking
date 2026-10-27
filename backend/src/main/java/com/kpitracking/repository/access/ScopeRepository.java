package com.kpitracking.repository.access;

import com.kpitracking.entity.access.Scope;
import com.kpitracking.enums.access.ScopeCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ScopeRepository extends JpaRepository<Scope, UUID> {

    Optional<Scope> findByCode(ScopeCode code);
}
