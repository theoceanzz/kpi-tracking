package com.kpitracking.repository;

import com.kpitracking.entity.BscCascadePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscCascadePolicyRepository extends JpaRepository<BscCascadePolicy, UUID> {

    List<BscCascadePolicy> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    /** Chinh sach gan RIENG cho mot dot — hep nhat, tra truoc tien. */
    @Query("SELECT p FROM BscCascadePolicy p JOIN p.kpiPeriods per WHERE p.organization.id = :orgId "
            + "AND per.id = :periodId AND p.status = com.kpitracking.enums.BscPolicyStatus.ACTIVE")
    List<BscCascadePolicy> findActiveByPeriod(@Param("orgId") UUID orgId, @Param("periodId") UUID periodId);

    /** Chinh sach gan RIENG cho mot ky. */
    @Query("SELECT p FROM BscCascadePolicy p WHERE p.organization.id = :orgId "
            + "AND p.kpiCycle.id = :cycleId AND p.status = com.kpitracking.enums.BscPolicyStatus.ACTIVE")
    List<BscCascadePolicy> findActiveByCycle(@Param("orgId") UUID orgId, @Param("cycleId") UUID cycleId);

    /**
     * Chinh sach MAC DINH cua to chuc: khong gan ky VA khong gan dot nao.
     *
     * <p>Dieu kien "khong gan dot" la bat buoc: chinh sach gan theo dot cung co kpi_cycle_id NULL,
     * thieu no thi mot chinh sach chi danh cho mot dot se bi lay lam mac dinh cho ca to chuc.
     */
    @Query("SELECT p FROM BscCascadePolicy p WHERE p.organization.id = :orgId "
            + "AND p.kpiCycle IS NULL AND p.kpiPeriods IS EMPTY "
            + "AND p.status = com.kpitracking.enums.BscPolicyStatus.ACTIVE")
    List<BscCascadePolicy> findActiveDefault(@Param("orgId") UUID orgId);

    Optional<BscCascadePolicy> findFirstByOrganizationIdOrderByCreatedAtAsc(UUID organizationId);
}
