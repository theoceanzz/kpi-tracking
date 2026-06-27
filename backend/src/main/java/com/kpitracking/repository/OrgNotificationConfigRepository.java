package com.kpitracking.repository;

import com.kpitracking.entity.OrgNotificationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgNotificationConfigRepository extends JpaRepository<OrgNotificationConfig, UUID> {

    List<OrgNotificationConfig> findByOrganizationId(UUID organizationId);

    Optional<OrgNotificationConfig> findByOrganizationIdAndEventCode(UUID organizationId, String eventCode);
}
