package com.kpitracking.repository;

import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.enums.SubmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KpiSubmissionRepository extends JpaRepository<KpiSubmission, UUID> {

    Page<KpiSubmission> findByStatus(SubmissionStatus status, Pageable pageable);

    Page<KpiSubmission> findByKpiCriteriaId(UUID kpiCriteriaId, Pageable pageable);

    Page<KpiSubmission> findBySubmittedById(UUID userId, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, SubmissionStatus status);

    long countByStatus(SubmissionStatus status);

    long countBySubmittedById(UUID userId);

    long countBySubmittedByIdAndStatus(UUID userId, SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId AND s.status = :status")
    long countByOrganizationIdAndStatus(@org.springframework.data.repository.query.Param("orgId") UUID orgId, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);

    // ===== Analytics queries =====

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.List<UUID> orgUnitIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    long countByOrgUnitIdInAndStatus(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.createdAt >= :from AND s.createdAt <= :to ORDER BY s.createdAt DESC")
    java.util.List<KpiSubmission> findBySubmittedByIdAndPeriod(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("from") java.time.Instant from, @org.springframework.data.repository.query.Param("to") java.time.Instant to);

    @org.springframework.data.jpa.repository.Query("SELECT MAX(s.createdAt) FROM KpiSubmission s WHERE s.submittedBy.id = :userId")
    java.time.Instant findLatestSubmissionDateByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);

    java.util.List<KpiSubmission> findBySubmittedByIdOrderByCreatedAtDesc(UUID userId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.kpiCriteria.id = :kpiId AND s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    long countByKpiCriteriaIdAndOrgUnitIdInAndStatus(@org.springframework.data.repository.query.Param("kpiId") UUID kpiId, @org.springframework.data.repository.query.Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(s.actualValue), 0) FROM KpiSubmission s WHERE s.kpiCriteria.id = :kpiId AND s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    double sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(@org.springframework.data.repository.query.Param("kpiId") UUID kpiId, @org.springframework.data.repository.query.Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);
}
