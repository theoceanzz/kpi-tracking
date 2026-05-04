package com.kpitracking.repository;

import com.kpitracking.entity.Report;
import com.kpitracking.enums.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {

    Page<Report> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<Report> findByOrgUnitIdAndStatus(UUID orgUnitId, ReportStatus status, Pageable pageable);

    Page<Report> findByCreatedById(UUID createdById, Pageable pageable);

    Page<Report> findByOrgUnitIdAndCreatedById(UUID orgUnitId, UUID createdById, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT r FROM Report r WHERE r.orgUnit.id = :orgUnitId AND (r.createdBy.id = :userId OR r.status = 'PUBLISHED')")
    Page<Report> findAccessibleReports(UUID orgUnitId, UUID userId, Pageable pageable);
}
