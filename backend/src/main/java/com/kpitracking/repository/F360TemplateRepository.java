package com.kpitracking.repository;

import com.kpitracking.entity.F360Template;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface F360TemplateRepository extends JpaRepository<F360Template, UUID> {

    List<F360Template> findByOrganizationIdOrderByCreatedAtAsc(UUID organizationId);

    Optional<F360Template> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /** Bộ mẫu dùng chung (không thuộc chiến dịch nào) — nguồn cho "Bắt đầu từ" và bộ mặc định. */
    List<F360Template> findByOrganizationIdAndCampaignIdIsNullOrderByCreatedAtAsc(UUID organizationId);
}
