package com.kpitracking.repository.auth;

import com.kpitracking.entity.auth.SecurityAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SecurityAuditLogRepository extends JpaRepository<SecurityAuditLog, UUID> {
}
