package com.kpitracking.repository;

import com.kpitracking.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByCode(String code);

    Optional<Permission> findByResourceAndAction(String resource, String action);

    List<Permission> findAllByIdIn(List<UUID> ids);
}
