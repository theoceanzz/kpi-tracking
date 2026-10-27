package com.kpitracking.repository.reward;

import com.kpitracking.entity.reward.RewardProgramRunItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface RewardProgramRunItemRepository extends JpaRepository<RewardProgramRunItem, UUID> {

    List<RewardProgramRunItem> findByRunIdOrderByOrderIndexAsc(UUID runId);

    void deleteByRunId(UUID runId);

    /** Lượt thưởng của chương trình tự động CHƯA ăn mừng: lần chạy đã phát và chưa bị hoàn tác. */
    @Query("""
            SELECT i FROM RewardProgramRunItem i JOIN FETCH i.run r JOIN FETCH r.program
             WHERE i.user.id = :userId
               AND i.celebratedAt IS NULL
               AND i.transactionId IS NOT NULL
               AND r.status = com.kpitracking.enums.reward.RewardRunStatus.ISSUED
               AND r.organization.id = :orgId
               AND COALESCE(r.executedAt, i.createdAt) >= :since
             ORDER BY COALESCE(r.executedAt, i.createdAt)
            """)
    List<RewardProgramRunItem> findUncelebrated(@Param("userId") UUID userId, @Param("orgId") UUID orgId,
                                                @Param("since") Instant since, Pageable page);

    @Modifying
    @Query("""
            UPDATE RewardProgramRunItem i SET i.celebratedAt = :now
             WHERE i.user.id = :userId AND i.run.id IN :runIds AND i.celebratedAt IS NULL
            """)
    int markCelebrated(@Param("userId") UUID userId, @Param("runIds") Collection<UUID> runIds,
                       @Param("now") Instant now);
}
