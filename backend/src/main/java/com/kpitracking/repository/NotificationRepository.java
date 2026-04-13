package com.kpitracking.repository;

import com.kpitracking.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Optional<Notification> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<Notification> findByCompanyIdAndUserIdOrderByCreatedAtDesc(UUID companyId, UUID userId, Pageable pageable);

    long countByCompanyIdAndUserIdAndIsReadFalse(UUID companyId, UUID userId);
}
