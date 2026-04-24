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

    @org.springframework.data.jpa.repository.Query("SELECT s FROM KpiSubmission s WHERE " +
           "(:isGlobalAdmin = true OR s.submittedBy.id = :currentUserId OR EXISTS (SELECT 1 FROM OrgUnit au WHERE s.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:status IS NULL OR s.status = :status) AND " +
           "(:kpiCriteriaId IS NULL OR s.kpiCriteria.id = :kpiCriteriaId) AND " +
           "(:submittedById IS NULL OR s.submittedBy.id = :submittedById) AND " +
           "(:orgUnitPath IS NULL OR s.orgUnit.path LIKE :orgUnitPath)")
    Page<KpiSubmission> findAllWithFilters(
            @org.springframework.data.repository.query.Param("isGlobalAdmin") boolean isGlobalAdmin,
            @org.springframework.data.repository.query.Param("currentUserId") UUID currentUserId,
            @org.springframework.data.repository.query.Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @org.springframework.data.repository.query.Param("status") SubmissionStatus status,
            @org.springframework.data.repository.query.Param("kpiCriteriaId") UUID kpiCriteriaId,
            @org.springframework.data.repository.query.Param("submittedById") UUID submittedById,
            @org.springframework.data.repository.query.Param("orgUnitPath") String orgUnitPath,
            Pageable pageable
    );

    Page<KpiSubmission> findByStatus(SubmissionStatus status, Pageable pageable);

    Page<KpiSubmission> findByKpiCriteriaId(UUID kpiCriteriaId, Pageable pageable);

    Page<KpiSubmission> findBySubmittedById(UUID userId, Pageable pageable);
    
    java.util.List<KpiSubmission> findByKpiCriteriaIdAndDeletedAtIsNull(UUID kpiCriteriaId);
    
    long countByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(UUID kpiCriteriaId, UUID userId);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, SubmissionStatus status);

    long countByStatus(SubmissionStatus status);

    long countByOrgUnitIdIn(java.util.Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(java.util.Collection<UUID> orgUnitIds, SubmissionStatus status);

    long countBySubmittedById(UUID userId);

    long countBySubmittedByIdAndStatus(UUID userId, SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId AND s.status = :status")
    long countByOrganizationIdAndStatus(@org.springframework.data.repository.query.Param("orgId") UUID orgId, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@org.springframework.data.repository.query.Param("path") String path);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.path LIKE :path AND s.status = :status")
    long countByOrgUnitPathAndStatus(@org.springframework.data.repository.query.Param("path") String path, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);
}
