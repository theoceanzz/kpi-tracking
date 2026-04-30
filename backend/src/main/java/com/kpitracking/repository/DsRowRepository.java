package com.kpitracking.repository;

import com.kpitracking.entity.DsRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DsRowRepository extends JpaRepository<DsRow, UUID> {

    Page<DsRow> findByDatasourceIdOrderByRowOrderAsc(UUID datasourceId, Pageable pageable);

    List<DsRow> findByDatasourceIdOrderByRowOrderAsc(UUID datasourceId);

    @Query("SELECT COALESCE(MAX(r.rowOrder), 0) FROM DsRow r WHERE r.datasource.id = :dsId")
    int findMaxRowOrder(@Param("dsId") UUID datasourceId);

    long countByDatasourceId(UUID datasourceId);

    void deleteByDatasourceId(UUID datasourceId);
}
