package com.kpitracking.repository;

import com.kpitracking.entity.RewardCheckinConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardCheckinConfigRepository extends JpaRepository<RewardCheckinConfig, UUID> {

    /**
     * Cấu hình của một tổ chức. Trả về TỐI ĐA MỘT dòng — partial unique index
     * {@code uq_reward_checkin_configs_org} bảo đảm điều đó, nên không cần luật ưu tiên
     * "nhiều cấu hình cùng khớp thì lấy cái nào".
     */
    Optional<RewardCheckinConfig> findByOrganizationId(UUID organizationId);
}
