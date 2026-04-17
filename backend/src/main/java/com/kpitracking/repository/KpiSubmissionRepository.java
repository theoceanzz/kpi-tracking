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

<<<<<<< HEAD
    Page<KpiSubmission> findByCompanyIdAndKpiCriteriaDepartmentId(UUID companyId, UUID departmentId, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndKpiCriteriaDepartmentIdIn(UUID companyId, java.util.Collection<UUID> departmentIds, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndKpiCriteriaDepartmentIdAndStatus(UUID companyId, UUID departmentId, SubmissionStatus status, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndKpiCriteriaDepartmentIdInAndStatus(UUID companyId, java.util.Collection<UUID> departmentIds, SubmissionStatus status, Pageable pageable);

    long countByCompanyId(UUID companyId);
=======
    long countByStatus(SubmissionStatus status);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b

    long countBySubmittedById(UUID userId);

    long countBySubmittedByIdAndStatus(UUID userId, SubmissionStatus status);
}
