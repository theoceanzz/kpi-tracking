package com.kpitracking.repository;

import com.kpitracking.entity.BscFactorBand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscFactorBandRepository extends JpaRepository<BscFactorBand, UUID> {

    List<BscFactorBand> findByPolicyIdOrderByDisplayOrderAsc(UUID policyId);

    void deleteByPolicyId(UUID policyId);
}
