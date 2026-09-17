package com.kpitracking.repository;

import com.kpitracking.entity.RagAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RagAssetRepository extends JpaRepository<RagAsset, String> {
}
