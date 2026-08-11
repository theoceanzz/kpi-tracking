package com.kpitracking.repository;

import com.kpitracking.entity.AiTokenQuota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiTokenQuotaRepository extends JpaRepository<AiTokenQuota, UUID> {

    List<AiTokenQuota> findByUserIdIn(List<UUID> userIds);

    /**
     * Tổng hạn mức một quản lý đã chia đi cho cấp dưới — vế trái của bất biến (2).
     * Phần tự tiêu được của họ = monthlyLimit trừ đi số này.
     */
    @Query("SELECT COALESCE(SUM(q.monthlyLimit), 0) FROM AiTokenQuota q WHERE q.allocatedBy = :allocatorId")
    long sumAllocatedBy(@Param("allocatorId") UUID allocatorId);

    /**
     * Tổng hạn mức đã cấp thẳng từ ngân sách công ty — vế trái của bất biến (1).
     * Lọc theo tổ chức qua đơn vị của người dùng vì bảng hạn mức không giữ organization_id.
     */
    @Query("SELECT COALESCE(SUM(q.monthlyLimit), 0) FROM AiTokenQuota q " +
           "WHERE q.allocatedBy IS NULL AND q.userId IN (" +
           "  SELECT DISTINCT uro.user.id FROM UserRoleOrgUnit uro " +
           "  WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :organizationId)")
    long sumAllocatedFromCompanyBudget(@Param("organizationId") UUID organizationId);
}
