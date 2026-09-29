package com.kpitracking.repository;

import com.kpitracking.entity.AiCriteriaSet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiCriteriaSetRepository extends JpaRepository<AiCriteriaSet, UUID> {

    List<AiCriteriaSet> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    Optional<AiCriteriaSet> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /** Mọi bộ ở một trạng thái của tổ chức — chọn bộ gần nhất theo cây đơn vị ở tầng service. */
    List<AiCriteriaSet> findByOrganizationIdAndStatus(UUID organizationId, String status);

    /** Bộ khác còn trỏ tới tài liệu kho tri thức này không (bản nhân bản dùng chung tài liệu). */
    boolean existsByRagDocumentIdAndIdNot(UUID ragDocumentId, UUID id);
}
