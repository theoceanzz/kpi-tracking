package com.kpitracking.repository;

import com.kpitracking.entity.RewardProgramRun;
import com.kpitracking.enums.RewardRunStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardProgramRunRepository extends JpaRepository<RewardProgramRun, UUID> {

    List<RewardProgramRun> findByProgramIdOrderByCreatedAtDesc(UUID programId);

    List<RewardProgramRun> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    /**
     * Bản xem trước hiện có cho cùng một (chương trình, kỳ). Xem trước lại sẽ THAY THẾ
     * bản này chứ không tạo thêm — thao tác tự nhiên sau khi sửa dữ liệu nguồn.
     */
    Optional<RewardProgramRun> findByProgramIdAndKpiCycleIdAndStatus(
            UUID programId, UUID kpiCycleId, RewardRunStatus status);

    Optional<RewardProgramRun> findByProgramIdAndKpiPeriodIdAndStatus(
            UUID programId, UUID kpiPeriodId, RewardRunStatus status);

    /**
     * Lớp chặn ở tầng service (bắt sớm, báo lỗi đẹp). Lớp thật sự chống hai cú bấm
     * đồng thời là unique index một phần {@code uq_reward_runs_issued_cycle} ở DB.
     */
    boolean existsByProgramIdAndKpiCycleIdAndStatus(UUID programId, UUID kpiCycleId, RewardRunStatus status);

    boolean existsByProgramIdAndKpiPeriodIdAndStatus(UUID programId, UUID kpiPeriodId, RewardRunStatus status);
}
