package com.kpitracking.repository;

import com.kpitracking.entity.DepartmentMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DepartmentMemberRepository extends JpaRepository<DepartmentMember, UUID> {

    List<DepartmentMember> findByDepartmentId(UUID departmentId);

    List<DepartmentMember> findByUserId(UUID userId);

    Optional<DepartmentMember> findByDepartmentIdAndUserId(UUID departmentId, UUID userId);

    boolean existsByDepartmentIdAndUserId(UUID departmentId, UUID userId);

    void deleteByDepartmentIdAndUserId(UUID departmentId, UUID userId);

    @Query("SELECT dm FROM DepartmentMember dm WHERE dm.department.company.id = :companyId AND dm.user.id = :userId")
    List<DepartmentMember> findByCompanyIdAndUserId(@Param("companyId") UUID companyId,
                                                     @Param("userId") UUID userId);

    long countByDepartmentId(UUID departmentId);
}
