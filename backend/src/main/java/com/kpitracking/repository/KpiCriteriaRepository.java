package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    Page<KpiCriteria> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<KpiCriteria> findByStatus(KpiStatus status, Pageable pageable);

    Page<KpiCriteria> findByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById")
    Page<KpiCriteria> findByCreatedById(@org.springframework.data.repository.query.Param("createdById") UUID createdById, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndStatus(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("status") KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitId(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitIdAndStatus(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, @org.springframework.data.repository.query.Param("status") KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a WHERE a.id = :userId OR k.createdBy.id = :userId")
    Page<KpiCriteria> findByUserIdInAssigneesOrCreatedBy(@org.springframework.data.repository.query.Param("userId") UUID userId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    Page<KpiCriteria> findByUserIdInAssignees(@org.springframework.data.repository.query.Param("userId") UUID userId, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = :status")
    long countByAssigneeAndStatus(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("status") KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId AND k.status = :status")
    long countByOrganizationIdAndStatus(@org.springframework.data.repository.query.Param("orgId") UUID orgId, @org.springframework.data.repository.query.Param("status") KpiStatus status);

    // ===== Analytics queries =====

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.createdAt >= :from AND k.createdAt <= :to")
    List<KpiCriteria> findApprovedByAssigneeIdAndPeriod(@Param("userId") UUID userId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@Param("orgUnitIds") List<UUID> orgUnitIds);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    long countByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    long countByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    List<KpiCriteria> findByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);
}
