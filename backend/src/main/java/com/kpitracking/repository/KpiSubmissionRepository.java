package com.kpitracking.repository;

import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.enums.SubmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiSubmissionRepository extends JpaRepository<KpiSubmission, UUID> {

    Optional<KpiSubmission> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<KpiSubmission> findByCompanyId(UUID companyId, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndStatus(UUID companyId, SubmissionStatus status, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndSubmittedById(UUID companyId, UUID userId, Pageable pageable);

    Page<KpiSubmission> findByCompanyIdAndKpiCriteriaId(UUID companyId, UUID kpiCriteriaId, Pageable pageable);

    long countByCompanyId(UUID companyId);

    long countByCompanyIdAndStatus(UUID companyId, SubmissionStatus status);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.company.id = :companyId " +
           "AND s.submittedBy.id = :userId AND s.status = :status")
    long countByCompanyIdAndSubmittedByIdAndStatus(@Param("companyId") UUID companyId,
                                                    @Param("userId") UUID userId,
                                                    @Param("status") SubmissionStatus status);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.company.id = :companyId AND s.submittedBy.id = :userId")
    long countByCompanyIdAndSubmittedById(@Param("companyId") UUID companyId,
                                           @Param("userId") UUID userId);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.company.id = :companyId " +
           "AND s.kpiCriteria.department.id = :departmentId")
    long countByCompanyIdAndDepartmentId(@Param("companyId") UUID companyId,
                                         @Param("departmentId") UUID departmentId);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.company.id = :companyId " +
           "AND s.kpiCriteria.department.id = :departmentId AND s.status = :status")
    long countByCompanyIdAndDepartmentIdAndStatus(@Param("companyId") UUID companyId,
                                                   @Param("departmentId") UUID departmentId,
                                                   @Param("status") com.kpitracking.enums.SubmissionStatus status);
}
