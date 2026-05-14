package com.kpitracking.repository;

import com.kpitracking.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserIdAndIsReadFalse(UUID userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Notification n SET n.isRead = true, n.readAt = :readAt WHERE n.user.id = :userId AND n.isRead = false")
    void markAllAsReadForUser(UUID userId, java.time.Instant readAt);

    // ===== Statistic Tool queries =====

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(n) FROM Notification n WHERE n.orgUnit.orgHierarchyLevel.organization.id = :orgId AND n.isRead = true")
    long countByIsReadTrueByOrgId(@Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(n) FROM Notification n WHERE n.orgUnit.orgHierarchyLevel.organization.id = :orgId AND n.isRead = false")
    long countByIsReadFalseByOrgId(@Param("orgId") UUID orgId);

    @Deprecated
    long countByIsReadTrue();

    @Deprecated
    long countByIsReadFalse();
}
