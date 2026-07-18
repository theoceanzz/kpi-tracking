package com.kpitracking.repository;

import com.kpitracking.entity.BscPerspective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscPerspectiveRepository extends JpaRepository<BscPerspective, UUID> {

    List<BscPerspective> findByOrganizationIdOrderByDisplayOrderAsc(UUID organizationId);

    Optional<BscPerspective> findFirstByOrganizationIdAndCodeIgnoreCase(UUID organizationId, String code);

    Optional<BscPerspective> findFirstByOrganizationIdAndNameIgnoreCase(UUID organizationId, String name);

    boolean existsByOrganizationIdAndCode(UUID organizationId, String code);

    boolean existsByOrganizationIdAndCodeAndIdNot(UUID organizationId, String code, UUID id);

    boolean existsByOrganizationIdAndDisplayOrder(UUID organizationId, Integer displayOrder);

    boolean existsByOrganizationIdAndDisplayOrderAndIdNot(UUID organizationId, Integer displayOrder, UUID id);

    long countByOrganizationId(UUID organizationId);
}
