package com.kpitracking.repository;

import com.kpitracking.entity.ReportDatasource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportDatasourceRepository extends JpaRepository<ReportDatasource, UUID> {

    List<ReportDatasource> findByReportId(UUID reportId);

    Optional<ReportDatasource> findByReportIdAndDatasourceId(UUID reportId, UUID datasourceId);

    boolean existsByDatasourceId(UUID datasourceId);
}
