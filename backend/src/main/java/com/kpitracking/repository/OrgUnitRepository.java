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
    Optional<OrgUnit> findByNameIgnoreCase(String name);
    
    @Query("SELECT o FROM OrgUnit o WHERE TRIM(LOWER(o.name)) = TRIM(LOWER(:name)) AND o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL")
    Optional<OrgUnit> findByNameSmart(@Param("name") String name, @Param("orgId") UUID orgId);

    @Query("SELECT o FROM OrgUnit o WHERE TRIM(LOWER(o.code)) = TRIM(LOWER(:code)) AND o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL")
    Optional<OrgUnit> findByCodeSmart(@Param("code") String code, @Param("orgId") UUID orgId);

    Optional<OrgUnit> findByNameIgnoreCaseAndOrgHierarchyLevel_Organization_Id(String name, UUID organizationId);
    Optional<OrgUnit> findByCode(String code);
    boolean existsByCode(String code);
    Optional<OrgUnit> findByIdAndOrgHierarchyLevel_Organization_Id(UUID id, UUID organizationId);

    Page<OrgUnit> findByOrgHierarchyLevel_Organization_Id(UUID organizationId, Pageable pageable);

    List<OrgUnit> findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(UUID organizationId);

    List<OrgUnit> findByNameContainingIgnoreCaseAndDeletedAtIsNull(String name);

    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.parent IS NULL AND o.deletedAt IS NULL")
    List<OrgUnit> findRootsByOrganizationId(@Param("orgId") UUID orgId);

    boolean existsByOrgHierarchyLevelId(UUID hierarchyLevelId);

    List<OrgUnit> findByParentId(UUID parentId);

    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.path LIKE CONCAT(:pathPrefix, '%') AND o.deletedAt IS NULL")
    List<OrgUnit> findSubtree(@Param("pathPrefix") String pathPrefix, @Param("orgId") UUID orgId);

    @Query("SELECT COUNT(ou) FROM OrgUnit ou WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND ou.deletedAt IS NULL AND ou.path != :pathPrefix")
    long countChildrenInSubtree(@Param("pathPrefix") String pathPrefix);

    boolean existsByNameAndOrgHierarchyLevel_Organization_IdAndParentId(String name, UUID organizationId, UUID parentId);

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
    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL AND EXISTS (SELECT 1 FROM OrgUnit p WHERE (o.path LIKE CONCAT(p.path, '%')) AND p.id IN :parentIds)")
    List<OrgUnit> findAllInSubtrees(@Param("parentIds") java.util.Collection<UUID> parentIds, @Param("orgId") UUID orgId);

    @Query("SELECT o FROM OrgUnit o WHERE o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL AND EXISTS (SELECT 1 FROM OrgUnit p WHERE (o.path LIKE CONCAT(p.path, '%')) AND p.id IN :parentIds)")
    List<OrgUnit> findAllInSubtreesForExecutive(@Param("parentIds") java.util.Collection<UUID> parentIds, @Param("orgId") UUID orgId);

    @Query("SELECT COUNT(o) > 0 FROM OrgUnit o WHERE TRIM(LOWER(o.code)) = TRIM(LOWER(:code)) AND o.orgHierarchyLevel.organization.id = :orgId AND o.deletedAt IS NULL")
    boolean existsByCodeSmart(@Param("code") String code, @Param("orgId") UUID orgId);

    @Query(value = "SELECT ou.* FROM org_units ou " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE TRIM(LOWER(ou.code)) = TRIM(LOWER(:code)) " +
            "AND ohl.organization_id = :orgId " +
            "AND ou.deleted_at IS NOT NULL LIMIT 1", nativeQuery = true)
    Optional<OrgUnit> findDeletedByCodeSmart(@Param("code") String code, @Param("orgId") UUID orgId);

    boolean existsByNameIgnoreCaseAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(String name, UUID organizationId);

    boolean existsByEmailAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(String email, UUID organizationId);
    boolean existsByPhoneAndOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(String phone, UUID organizationId);

    @Query("SELECT o FROM OrgUnit o WHERE o.deletedAt IS NULL " +
           "AND o.orgHierarchyLevel.organization.id = :orgId " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(CAST(o.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    List<OrgUnit> searchByKeyword(@Param("orgId") UUID orgId, @Param("keyword") String keyword, Pageable pageable);
}
