package com.kpitracking.repository;

import com.kpitracking.entity.DsCell;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DsCellRepository extends JpaRepository<DsCell, UUID> {

    List<DsCell> findByRowId(UUID rowId);

    Optional<DsCell> findByRowIdAndColumnId(UUID rowId, UUID columnId);

    List<DsCell> findByRowIdIn(List<UUID> rowIds);

    @Query("SELECT c FROM DsCell c WHERE c.column.id = :columnId AND c.row.datasource.id = :datasourceId")
    List<DsCell> findByColumnIdAndDatasourceId(@Param("columnId") UUID columnId, @Param("datasourceId") UUID datasourceId);

    void deleteByRowId(UUID rowId);
}
