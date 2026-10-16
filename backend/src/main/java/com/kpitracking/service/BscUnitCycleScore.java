package com.kpitracking.service;

import com.kpitracking.entity.BscCascadePolicy;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.BscUnitResultStatus;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Điểm BSC của MỘT đơn vị trong một kỳ, dùng để chọn khung bell curve.
 *
 * <ul>
 *   <li>Mỗi đợt của kỳ: bộ tiêu chí gắn đúng đơn vị ({@link BscScoringService#resolveScorecard}) → kết
 *       quả đơn vị của đợt → % đạt, cắt ở trần điểm công nhận của chính sách đợt đó (không có chính sách:
 *       {@link BscCascadeService#DEFAULT_RECOGNIZED_CAP_PERCENT}).</li>
 *   <li>Điểm kỳ = trung bình các đợt có số.</li>
 *   <li>{@code finalized} = MỌI đợt đơn vị có bộ tiêu chí đều đã chốt kết quả. Chỉ số đã chốt mới đổi khung
 *       kiểm tra; chưa chốt thì chỉ là khung dự kiến để tham khảo.</li>
 * </ul>
 * Đơn vị không có bộ tiêu chí ở đợt nào ⇒ {@code percent = null} (dùng khung mặc định).
 */
@Component
@RequiredArgsConstructor
public class BscUnitCycleScore {

    private final KpiPeriodRepository kpiPeriodRepository;
    private final BscScoringService bscScoringService;
    private final BscUnitResultRepository unitResultRepository;
    private final BscCascadeService bscCascadeService;

    public record Score(Double percent, boolean finalized) {
        public static final Score NONE = new Score(null, false);
    }

    @Transactional(readOnly = true)
    public Score forCycle(OrgUnit unit, UUID organizationId, UUID cycleId) {
        if (unit == null || organizationId == null || cycleId == null) return Score.NONE;
        List<Double> values = new ArrayList<>();
        int applicable = 0, finalizedCount = 0;
        for (KpiPeriod period : kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycleId)) {
            BscScorecard card = bscScoringService.resolveScorecard(unit, organizationId, period.getId());
            if (card == null) continue;
            applicable++;
            BscUnitResult result = unitResultRepository
                    .findByScorecardIdAndKpiPeriodId(card.getId(), period.getId()).orElse(null);
            if (result == null || result.getAchievementPercent() == null) continue;
            BscCascadePolicy policy = bscCascadeService.resolvePolicy(organizationId, period.getId());
            double cap = policy != null && policy.getRecognizedCapPercent() != null
                    ? policy.getRecognizedCapPercent() : BscCascadeService.DEFAULT_RECOGNIZED_CAP_PERCENT;
            values.add(Math.min(result.getAchievementPercent(), cap));
            if (result.getStatus() != BscUnitResultStatus.DRAFT) finalizedCount++;
        }
        if (values.isEmpty()) return Score.NONE;
        double avg = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        return new Score(Math.round(avg * 10.0) / 10.0, applicable > 0 && finalizedCount == applicable);
    }
}
