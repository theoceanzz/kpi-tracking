package com.kpitracking.repository.ai;

import com.kpitracking.entity.ai.RagAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RagAssetRepository extends JpaRepository<RagAsset, String> {
}
