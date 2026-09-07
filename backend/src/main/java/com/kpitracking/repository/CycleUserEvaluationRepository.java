package com.kpitracking.repository;

import com.kpitracking.entity.CycleUserEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycleUserEvaluationRepository extends JpaRepository<CycleUserEvaluation, UUID> {

    Optional<CycleUserEvaluation> findByKpiCycleIdAndUserId(UUID kpiCycleId, UUID userId);

    List<CycleUserEvaluation> findByKpiCycleIdAndUserIdIn(UUID kpiCycleId, List<UUID> userIds);

    /**
     * Toàn bộ phiếu chốt kỳ của một kỳ, để dựng bảng xếp hạng.
     *
     * <p>{@code JOIN FETCH} người được chấm vì bảng xếp hạng luôn hiện tên kèm ảnh đại diện;
     * để lazy thì mỗi dòng là một truy vấn phụ.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT e FROM CycleUserEvaluation e
              JOIN FETCH e.user u
             WHERE e.kpiCycle.id = :cycleId
               AND e.deletedAt IS NULL
            """)
    List<CycleUserEvaluation> findAllForCycle(@org.springframework.data.repository.query.Param("cycleId") UUID cycleId);
}
