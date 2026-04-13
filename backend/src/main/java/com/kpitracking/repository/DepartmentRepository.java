package com.kpitracking.repository;

import com.kpitracking.entity.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, UUID> {

    Optional<Department> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<Department> findByCompanyId(UUID companyId, Pageable pageable);

    List<Department> findAllByCompanyId(UUID companyId);

    boolean existsByNameAndCompanyId(String name, UUID companyId);

    long countByCompanyId(UUID companyId);
}
