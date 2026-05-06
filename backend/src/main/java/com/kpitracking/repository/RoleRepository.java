package com.kpitracking.repository;

import com.kpitracking.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByNameAndOrganizationId(String name, UUID organizationId);

    Optional<Role> findByNameIgnoreCaseAndOrganizationId(String name, UUID organizationId);

    boolean existsByNameAndOrganizationId(String name, UUID organizationId);
    boolean existsByNameIgnoreCaseAndOrganizationId(String name, UUID organizationId);
    
    boolean existsByNameIgnoreCaseAndOrganizationIdAndIdNot(String name, UUID organizationId, UUID id);
    
    Optional<Role> findFirstByIsSystemTrueOrderByLevelAscRankAsc();

    Optional<Role> findByLevelAndRankAndOrganizationId(Integer level, Integer rank, UUID organizationId);

    boolean existsByLevelAndRankAndOrganizationIdAndDeletedAtIsNull(Integer level, Integer rank, UUID organizationId);
    boolean existsByLevelAndRankAndOrganizationIdAndIdNotAndDeletedAtIsNull(Integer level, Integer rank, UUID organizationId, UUID id);

    List<Role> findAllByOrganizationIdAndDeletedAtIsNull(UUID organizationId);

    List<Role> findByOrganizationIdAndRank(UUID organizationId, Integer rank);

    List<Role> findAllByDeletedAtIsNull();
}
