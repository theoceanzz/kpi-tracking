package com.kpitracking.repository;

import com.kpitracking.entity.RolePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RolePolicyRepository extends JpaRepository<RolePolicy, RolePolicy.RolePolicyId> {

    @Query("SELECT rp FROM RolePolicy rp JOIN FETCH rp.policy WHERE rp.role.id = :roleId")
    List<RolePolicy> findByRoleId(@Param("roleId") UUID roleId);

    void deleteByRoleIdAndPolicyId(UUID roleId, UUID policyId);

    boolean existsByRoleIdAndPolicyId(UUID roleId, UUID policyId);
}
