package com.kpitracking.repository;

import com.kpitracking.entity.Role;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByNameAndOrganizationId(String name, UUID organizationId);

    Optional<Role> findByNameIgnoreCaseAndOrganizationId(String name, UUID organizationId);

    boolean existsByNameAndOrganizationId(String name, UUID organizationId);
    boolean existsByNameIgnoreCaseAndOrganizationIdAndDeletedAtIsNull(String name, UUID organizationId);
    
    boolean existsByNameIgnoreCaseAndOrganizationIdAndIdNotAndDeletedAtIsNull(String name, UUID organizationId, UUID id);
    
    Optional<Role> findFirstByIsSystemTrueOrderByLevelAscRankAsc();

    Optional<Role> findByLevelAndRankAndOrganizationId(Integer level, Integer rank, UUID organizationId);

    boolean existsByLevelAndRankAndOrganizationIdAndDeletedAtIsNull(Integer level, Integer rank, UUID organizationId);
    boolean existsByLevelAndRankAndOrganizationIdAndIdNotAndDeletedAtIsNull(Integer level, Integer rank, UUID organizationId, UUID id);

    List<Role> findAllByOrganizationIdAndDeletedAtIsNull(UUID organizationId);

    List<Role> findByOrganizationIdAndRank(UUID organizationId, Integer rank);

    List<Role> findAllByDeletedAtIsNull();

    @Query("SELECT r FROM Role r WHERE r.organization.id = :orgId AND r.deletedAt IS NULL " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(CAST(r.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    List<Role> searchByKeyword(@Param("orgId") UUID orgId, @Param("keyword") String keyword, Pageable pageable);
}
