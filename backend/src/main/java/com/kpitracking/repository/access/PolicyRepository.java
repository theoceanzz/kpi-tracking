package com.kpitracking.repository.access;

import com.kpitracking.entity.access.Policy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PolicyRepository extends JpaRepository<Policy, UUID> {

    List<Policy> findByOrgUnitId(UUID orgUnitId);
}
