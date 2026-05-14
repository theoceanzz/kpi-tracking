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

    Optional<OrgUnit> findByIdAndOrgHierarchyLevel_Organization_Id(UUID id, UUID organizationId);

    Page<OrgUnit> findByOrgHierarchyLevel_Organization_Id(UUID organizationId, Pageable pageable);

    List<OrgUnit> findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(UUID organizationId);

    List<OrgUnit> findByNameContainingIgnoreCaseAndDeletedAtIsNull(String name);

    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.parent IS NULL AND o.deletedAt IS NULL")
    List<OrgUnit> findRootsByOrganizationId(@Param("orgId") UUID orgId);

    boolean existsByOrgHierarchyLevelId(UUID hierarchyLevelId);

    List<OrgUnit> findByParentId(UUID parentId);

    @Query("SELECT o FROM OrgUnit o WHERE o.path LIKE CONCAT(:pathPrefix, '%') AND o.deletedAt IS NULL")
    List<OrgUnit> findSubtree(@Param("pathPrefix") String pathPrefix);

    @Query("SELECT COUNT(ou) FROM OrgUnit ou WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND ou.deletedAt IS NULL AND ou.path != :pathPrefix")
    long countChildrenInSubtree(@Param("pathPrefix") String pathPrefix);

    boolean existsByNameAndOrgHierarchyLevel_Organization_IdAndParentId(String name, UUID organizationId, UUID parentId);

    // ===== Statistic Tool queries =====

    long countByStatusAndOrgHierarchyLevel_Organization_Id(com.kpitracking.enums.OrgUnitStatus status, UUID organizationId);

    @Query("SELECT o.orgHierarchyLevel.unitTypeName, o.orgHierarchyLevel.levelOrder, COUNT(o) " +
           "FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL " +
           "GROUP BY o.orgHierarchyLevel.unitTypeName, o.orgHierarchyLevel.levelOrder " +
           "ORDER BY o.orgHierarchyLevel.levelOrder")
    List<Object[]> countGroupByHierarchyLevelOrderedByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(o) FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL")
    long countAllActiveByOrgId(@Param("orgId") UUID orgId);

    long countByOrgHierarchyLevel_Organization_Id(UUID organizationId);

    @Deprecated
    long countByStatus(com.kpitracking.enums.OrgUnitStatus status);

    @Deprecated
    @Query("SELECT o.orgHierarchyLevel.unitTypeName, COUNT(o) FROM OrgUnit o WHERE o.deletedAt IS NULL GROUP BY o.orgHierarchyLevel.unitTypeName")
    List<Object[]> countGroupByHierarchyLevel();

    @Deprecated
    @Query("SELECT o.orgHierarchyLevel.unitTypeName, o.orgHierarchyLevel.levelOrder, COUNT(o) FROM OrgUnit o WHERE o.deletedAt IS NULL GROUP BY o.orgHierarchyLevel.unitTypeName, o.orgHierarchyLevel.levelOrder ORDER BY o.orgHierarchyLevel.levelOrder")
    List<Object[]> countGroupByHierarchyLevelOrdered();

    @Deprecated
    @Query("SELECT COUNT(o) FROM OrgUnit o WHERE o.deletedAt IS NULL")
    long countAllActive();
}
