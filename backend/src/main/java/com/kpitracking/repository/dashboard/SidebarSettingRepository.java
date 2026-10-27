package com.kpitracking.repository.dashboard;

import com.kpitracking.entity.dashboard.SidebarSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SidebarSettingRepository extends JpaRepository<SidebarSetting, UUID> {
    List<SidebarSetting> findByOrganizationId(UUID organizationId);
    Optional<SidebarSetting> findByOrganizationIdAndMenuKey(UUID organizationId, String menuKey);
}
