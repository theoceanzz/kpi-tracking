package com.kpitracking.repository;

import com.kpitracking.entity.BscFixedPerspectiveEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscFixedPerspectiveRepository extends JpaRepository<BscFixedPerspectiveEntity, UUID> {

    List<BscFixedPerspectiveEntity> findByOrganizationIdOrderByDisplayOrderAsc(UUID organizationId);

    Optional<BscFixedPerspectiveEntity> findByOrganizationIdAndCode(UUID organizationId, String code);

    boolean existsByOrganizationId(UUID organizationId);
}
