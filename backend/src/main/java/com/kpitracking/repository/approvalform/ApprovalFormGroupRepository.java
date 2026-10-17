package com.kpitracking.repository.approvalform;

import com.kpitracking.entity.approvalform.ApprovalFormGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApprovalFormGroupRepository extends JpaRepository<ApprovalFormGroup, UUID> {

    List<ApprovalFormGroup> findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(UUID organizationId);

    Optional<ApprovalFormGroup> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /**
     * Đánh dấu tổ chức đã được dựng sẵn nhóm + đơn mẫu. Trả 1 đúng một lần cho mỗi tổ chức — hai request đồng thời
     * thì chỉ một bên dựng.
     */
    @Modifying
    @Query(value = "UPDATE organizations SET approval_forms_seeded_at = now() " +
                   "WHERE id = :orgId AND approval_forms_seeded_at IS NULL", nativeQuery = true)
    int markSeeded(@Param("orgId") UUID orgId);
}
