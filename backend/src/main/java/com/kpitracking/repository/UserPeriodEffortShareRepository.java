package com.kpitracking.repository;

import com.kpitracking.entity.UserPeriodEffortShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserPeriodEffortShareRepository extends JpaRepository<UserPeriodEffortShare, UserPeriodEffortShare.Key> {

    List<UserPeriodEffortShare> findByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId);

    boolean existsByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId);
}
