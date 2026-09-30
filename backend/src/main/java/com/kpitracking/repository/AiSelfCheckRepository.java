package com.kpitracking.repository;

import com.kpitracking.entity.AiSelfCheck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AiSelfCheckRepository extends JpaRepository<AiSelfCheck, UUID> {

    /** Lần soi mới nhất của một người cho một chỉ tiêu — mở lại trang nộp bài thì hiện lại. */
    Optional<AiSelfCheck> findFirstByUserIdAndKpiCriteriaIdOrderByCreatedAtDesc(UUID userId, UUID kpiCriteriaId);

    /** Lần soi gần nhất cho ĐÚNG bài này (cùng băm) — có rồi thì trả lại, không tốn token lần hai. */
    Optional<AiSelfCheck> findFirstByUserIdAndKpiCriteriaIdAndInputHashOrderByCreatedAtDesc(
            UUID userId, UUID kpiCriteriaId, String inputHash);
}
