package com.kpitracking.service.reward;

import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.RewardProgram;
import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRunStatus;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.RewardProgramRepository;
import com.kpitracking.repository.RewardProgramRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.kpitracking.dto.response.reward.RewardProgramRunResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tự động phát thưởng khi đợt/kỳ đã KẾT THÚC theo ngày.
 *
 * <h2>Vì sao bám vào ngày kết thúc</h2>
 * {@code kpi_periods} và {@code kpi_cycles} không có cột trạng thái nên hệ thống không
 * có sự kiện "đóng đợt". Thao tác chốt đánh giá ({@code CycleUnitEvaluation}) thì chỉ có
 * ở KỲ, không có ở ĐỢT — bám vào đó thì chương trình theo đợt vĩnh viễn không tự chạy được.
 * Ngày kết thúc là thứ duy nhất cả hai đều có.
 *
 * <h2>Ba lớp chặn phát nhầm hàng loạt</h2>
 * <ol>
 *   <li><b>Không phát cho kỳ/đợt kết thúc TRƯỚC khi chương trình được tạo.</b> Thiếu lớp
 *       này, bật {@code autoTrigger} lên là hệ thống lập tức trả thưởng ngược cho toàn
 *       bộ lịch sử — hàng chục kỳ cũ, không ai kịp phản ứng.</li>
 *   <li><b>Chỉ nhìn lại trong {@link #LOOKBACK_DAYS} ngày.</b> Chương trình bị tắt vài
 *       tháng rồi bật lại cũng không kéo theo một loạt lần phát tồn đọng.</li>
 *   <li><b>Unique index một phần ở DB</b> vẫn là chốt chặn cuối chống phát trùng, kể cả
 *       khi có nhiều tiến trình cùng chạy.</li>
 * </ol>
 *
 * <p>Phát tay vẫn dùng được bình thường và có thể phát SỚM hơn ngày kết thúc — lúc đó
 * bộ này thấy đã có bản ISSUED nên bỏ qua.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardAutoIssueScheduler {

    /**
     * Chỉ xét kỳ/đợt kết thúc trong vòng chừng này ngày. Đủ rộng để chạy trễ vài ngày
     * (máy chủ tắt, lỗi mạng) mà vẫn bắt kịp, đủ hẹp để không đào lại lịch sử.
     */
    private static final int LOOKBACK_DAYS = 30;

    private final RewardProgramRepository programRepository;
    private final RewardProgramRunRepository runRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final RewardProgramRunService runService;

    /** Chạy 1 lần mỗi ngày lúc 1 giờ sáng — thưởng theo kỳ không cần độ trễ tính bằng phút. */
    @Scheduled(cron = "0 0 1 * * *")
    public void autoIssueFinishedTargets() {
        Instant now = Instant.now();
        Instant lookbackFrom = now.minusSeconds(LOOKBACK_DAYS * 86400L);

        List<RewardProgram> programs = programRepository.findAllAutoTriggerEnabled();
        if (programs.isEmpty()) return;

        log.info("Tự động phát thưởng: xét {} chương trình", programs.size());

        for (RewardProgram program : programs) {
            try {
                for (UUID targetId : targetsReadyFor(program, now, lookbackFrom)) {
                    issueOne(program, targetId);
                }
            } catch (Exception e) {
                // Một chương trình hỏng không được làm chết cả vòng lặp — các chương
                // trình còn lại vẫn phải được xử lý.
                log.error("Lỗi khi tự phát thưởng cho chương trình {} ({})",
                        program.getName(), program.getId(), e);
            }
        }
    }

    /**
     * Các kỳ/đợt đã kết thúc, đủ điều kiện phát cho chương trình này.
     *
     * <p>Chương trình gắn cứng thì chỉ có tối đa một mục tiêu. Chương trình dùng chung
     * thì quét mọi kỳ/đợt của tổ chức trong khoảng nhìn lại.
     */
    private List<UUID> targetsReadyFor(RewardProgram program, Instant now, Instant lookbackFrom) {
        Instant createdAt = program.getCreatedAt() != null ? program.getCreatedAt() : Instant.EPOCH;
        // Không trả thưởng ngược cho kỳ đã kết thúc trước khi chương trình ra đời.
        Instant floor = createdAt.isAfter(lookbackFrom) ? createdAt : lookbackFrom;

        if (program.hasFixedTarget()) {
            UUID id = program.fixedTargetId();
            Instant end = program.getScope() == RewardProgramScope.CYCLE
                    ? kpiCycleRepository.findById(id).map(KpiCycle::getEndDate).orElse(null)
                    : kpiPeriodRepository.findById(id).map(KpiPeriod::getEndDate).orElse(null);
            return isReady(end, now, floor) && !alreadyIssued(program, id) ? List.of(id) : List.of();
        }

        UUID orgId = program.getOrganization().getId();
        if (program.getScope() == RewardProgramScope.CYCLE) {
            return kpiCycleRepository.findByOrganizationId(orgId).stream()
                    .filter(c -> isReady(c.getEndDate(), now, floor))
                    .map(KpiCycle::getId)
                    .filter(id -> !alreadyIssued(program, id))
                    .toList();
        }
        return kpiPeriodRepository.findByOrganizationId(orgId).stream()
                .filter(p -> isReady(p.getEndDate(), now, floor))
                .map(KpiPeriod::getId)
                .filter(id -> !alreadyIssued(program, id))
                .toList();
    }

    private boolean isReady(Instant endDate, Instant now, Instant floor) {
        return endDate != null && endDate.isBefore(now) && endDate.isAfter(floor);
    }

    private boolean alreadyIssued(RewardProgram program, UUID targetId) {
        return program.getScope() == RewardProgramScope.CYCLE
                ? runRepository.existsByProgramIdAndKpiCycleIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.ISSUED)
                : runRepository.existsByProgramIdAndKpiPeriodIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.ISSUED);
    }

    /**
     * Xem trước rồi phát ngay, trong hai transaction tách rời.
     *
     * <p>Vẫn đi qua đúng luồng của người dùng thay vì viết một đường tắt riêng: mọi kiểm
     * tra (trần điểm mỗi lần phát, chống phát trùng, so vân tay bảng xếp hạng) đều được
     * áp y hệt. Một đường tắt riêng sẽ lệch pha với luồng chính ngay lần đầu ai đó sửa luật.
     */
    private void issueOne(RewardProgram program, UUID targetId) {
        try {
            RewardProgramRunResponse preview = runService.previewAsSystem(program.getId(), targetId);
            if (preview.getRecipientCount() == 0) {
                log.info("Bỏ qua: không ai đủ điều kiện. Chương trình={}, mục tiêu={}",
                        program.getName(), targetId);
                return;
            }
            runService.issueAsSystem(preview.getId());
            log.info("Đã tự phát {} điểm cho {} người. Chương trình={}, mục tiêu={}",
                    preview.getTotalPoints(), preview.getRecipientCount(),
                    program.getName(), targetId);
        } catch (Exception e) {
            log.error("Không tự phát được. Chương trình={}, mục tiêu={}, lý do={}",
                    program.getName(), targetId, e.getMessage());
        }
    }
}
