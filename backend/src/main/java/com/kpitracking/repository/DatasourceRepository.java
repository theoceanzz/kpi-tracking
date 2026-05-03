package com.kpitracking.repository;

import com.kpitracking.entity.Datasource;
import com.kpitracking.enums.DatasourceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DatasourceRepository extends JpaRepository<Datasource, UUID> {

    Page<Datasource> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<Datasource> findByOrgUnitIdAndStatus(UUID orgUnitId, DatasourceStatus status, Pageable pageable);

    Page<Datasource> findByStatus(DatasourceStatus status, Pageable pageable);
}
