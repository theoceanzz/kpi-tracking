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

    Optional<OrgUnit> findByName(String name);
    Optional<OrgUnit> findByCode(String code);
    boolean existsByCode(String code);
    Optional<OrgUnit> findByIdAndOrgHierarchyLevel_Organization_Id(UUID id, UUID organizationId);

    Page<OrgUnit> findByOrgHierarchyLevel_Organization_Id(UUID organizationId, Pageable pageable);

    List<OrgUnit> findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(UUID organizationId);

    List<OrgUnit> findByNameContainingIgnoreCaseAndDeletedAtIsNull(String name);

    List<OrgUnit> findByParentId(UUID parentId);

    @Query("SELECT o FROM OrgUnit o WHERE o.path LIKE CONCAT(:pathPrefix, '%') AND o.deletedAt IS NULL")
    List<OrgUnit> findSubtree(@Param("pathPrefix") String pathPrefix);

    boolean existsByNameAndOrgHierarchyLevel_Organization_IdAndParentId(String name, UUID organizationId, UUID parentId);

    long countByOrgHierarchyLevel_Organization_Id(UUID organizationId);

    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.parent IS NULL AND o.deletedAt IS NULL")
    List<OrgUnit> findRootsByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT o FROM OrgUnit o WHERE o.deletedAt IS NULL AND EXISTS (SELECT 1 FROM OrgUnit p WHERE (o.path LIKE CONCAT(p.path, '%')) AND p.id IN :parentIds)")
    List<OrgUnit> findAllInSubtrees(@Param("parentIds") java.util.Collection<UUID> parentIds);

    @Query("SELECT o FROM OrgUnit o WHERE o.deletedAt IS NULL AND EXISTS (SELECT 1 FROM OrgUnit p WHERE (o.path LIKE CONCAT(p.path, '%')) AND p.id IN :parentIds)")
    List<OrgUnit> findAllInSubtreesForExecutive(@Param("parentIds") java.util.Collection<UUID> parentIds);

    boolean existsByOrgHierarchyLevelId(UUID hierarchyLevelId);
}
