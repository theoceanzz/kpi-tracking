package com.kpitracking.repository.dashboard;

import com.kpitracking.entity.dashboard.UserDashboardLayout;
import com.kpitracking.enums.dashboard.DashboardScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserDashboardLayoutRepository extends JpaRepository<UserDashboardLayout, UUID> {

    Optional<UserDashboardLayout> findByUserIdAndScope(UUID userId, DashboardScope scope);

    void deleteByUserIdAndScope(UUID userId, DashboardScope scope);
}
