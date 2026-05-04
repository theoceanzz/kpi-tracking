package com.kpitracking.repository;

import com.kpitracking.entity.DsColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DsColumnRepository extends JpaRepository<DsColumn, UUID> {

    List<DsColumn> findByDatasourceIdOrderByColumnOrderAsc(UUID datasourceId);

    @Query("SELECT COALESCE(MAX(c.columnOrder), 0) FROM DsColumn c WHERE c.datasource.id = :dsId")
    int findMaxColumnOrder(@Param("dsId") UUID datasourceId);

    void deleteByDatasourceId(UUID datasourceId);
}
