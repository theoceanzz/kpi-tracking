package com.kpitracking.repository.approvalform;

import com.kpitracking.entity.approvalform.ApprovalForm;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApprovalFormRepository extends JpaRepository<ApprovalForm, UUID> {

    List<ApprovalForm> findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(UUID organizationId);

    List<ApprovalForm> findByGroupIdOrderBySortOrderAscCreatedAtAsc(UUID groupId);

    Optional<ApprovalForm> findByIdAndOrganizationId(UUID id, UUID organizationId);

    long countByGroupId(UUID groupId);
}
