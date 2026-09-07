package com.kpitracking.repository;

import com.kpitracking.entity.BscUnitResultItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscUnitResultItemRepository extends JpaRepository<BscUnitResultItem, UUID> {

    List<BscUnitResultItem> findByUnitResultId(UUID unitResultId);

    void deleteByUnitResultId(UUID unitResultId);
}
