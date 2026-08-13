package com.kpitracking.repository;

import com.kpitracking.entity.RewardProgram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardProgramRepository extends JpaRepository<RewardProgram, UUID> {

    List<RewardProgram> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    List<RewardProgram> findByOrganizationIdAndEnabledTrue(UUID organizationId);

    /**
     * Mọi chương trình bật tự động phát, thuộc tổ chức đã bật tính năng thưởng.
     *
     * <p>Lọc luôn {@code enable_reward}: tổ chức tắt tính năng mà bộ chạy nền vẫn phát
     * điểm cho họ thì đó là điểm phát ra sau lưng người dùng.
     */
    @Query("""
            SELECT p FROM RewardProgram p
             WHERE p.enabled = true
               AND p.autoTrigger = true
               AND p.organization.enableReward = true
            """)
    List<RewardProgram> findAllAutoTriggerEnabled();

    List<RewardProgram> findByKpiCycleId(UUID kpiCycleId);
}
