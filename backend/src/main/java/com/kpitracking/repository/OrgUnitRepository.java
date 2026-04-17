package com.kpitracking.repository;

import com.kpitracking.entity.OrgUnit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgUnitRepository extends JpaRepository<OrgUnit, UUID> {

    Optional<OrgUnit> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Page<OrgUnit> findByOrganizationId(UUID organizationId, Pageable pageable);

    List<OrgUnit> findByOrganizationIdAndDeletedAtIsNull(UUID organizationId);

    List<OrgUnit> findByParentId(UUID parentId);

    @Query("SELECT o FROM OrgUnit o WHERE o.path LIKE CONCAT(:pathPrefix, '%') AND o.deletedAt IS NULL")
    List<OrgUnit> findSubtree(@Param("pathPrefix") String pathPrefix);

    boolean existsByNameAndOrganizationIdAndParentId(String name, UUID organizationId, UUID parentId);

    long countByOrganizationId(UUID organizationId);

    @Query("SELECT o FROM OrgUnit o WHERE o.organization.id = :orgId AND o.parent IS NULL AND o.deletedAt IS NULL")
    List<OrgUnit> findRootsByOrganizationId(@Param("orgId") UUID orgId);
}
