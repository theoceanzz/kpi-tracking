package com.kpitracking.service.feedback360;

import com.kpitracking.entity.*;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360ScoringMode;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import com.kpitracking.service.kpi.CycleLockChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Guard HAI CHIỀU giữa chiến dịch 360 có ảnh hưởng điểm và việc khoá kỳ (§7.2-5).
 *
 * <ul>
 *   <li>Chốt dữ liệu kỳ ở đơn vị U bị chặn khi còn chiến dịch ảnh hưởng điểm của kỳ đó đang
 *       NOMINATING/OPEN với người được đánh giá thuộc U (hoặc đơn vị con).</li>
 *   <li>Ngược lại, launch/start/reopen/thêm người vào chiến dịch ảnh hưởng điểm bị chặn khi đơn vị
 *       của người được đánh giá đã khoá đầu vào — nếu không, kết quả 360 không bao giờ vào được kỳ.</li>
 * </ul>
 *
 * Chỉ phụ thuộc repository + {@link CycleLockChecker} để {@code KpiCycleEvaluationService} gọi được
 * mà không tạo vòng bean. Chiến dịch "chỉ để phát triển" không qua guard này.
 */
@Component
@RequiredArgsConstructor
public class F360CycleGuard {

    private final F360CampaignRepository campaignRepository;
    private final F360SubjectRepository subjectRepository;
    private final CycleLockChecker cycleLockChecker;

    /** Chiến dịch này có đi vào xếp loại kỳ không. */
    public static boolean affectsRating(F360Campaign c) {
        return c.getKpiCycle() != null
                && c.getScoringMode() != null && c.getScoringMode() != F360ScoringMode.DEVELOPMENT_ONLY
                && c.getOrganization() != null
                && Boolean.TRUE.equals(c.getOrganization().getEnableFeedback360())
                && Boolean.TRUE.equals(c.getOrganization().getFeedback360AffectsRating());
    }

    /** Gọi từ {@code startCalibration}: chặn nếu còn chiến dịch ảnh hưởng điểm đang chạy trong đơn vị. */
    public void assertCanCalibrate(UUID cycleId, OrgUnit unit) {
        if (unit == null || unit.getPath() == null) return;
        for (F360Campaign c : campaignRepository.findScoringByCycle(cycleId,
                List.of(F360CampaignStatus.NOMINATING, F360CampaignStatus.OPEN))) {
            if (!affectsRating(c)) continue;
            boolean touches = subjectRepository.findByCampaignIdWithUser(c.getId()).stream()
                    .anyMatch(s -> s.getOrgUnit() != null && s.getOrgUnit().getPath() != null
                            && s.getOrgUnit().getPath().startsWith(unit.getPath()));
            if (touches) {
                throw new BusinessException(ErrorCode.CLOSE_F360_CAMPAIGN_BEFORE_FINALIZING_CYCLE_DATA, c.getName());
            }
        }
    }

    /** Gọi khi launch/start/reopen/thêm người: chặn nếu người được đánh giá thuộc đơn vị đã khoá đầu vào. */
    public void assertInputsOpen(F360Campaign c, Collection<F360Subject> subjects) {
        if (!affectsRating(c)) return;
        Set<String> locked = new LinkedHashSet<>();
        for (F360Subject s : subjects) {
            CycleUnitEvaluation lock = cycleLockChecker.inputLockFor(c.getKpiCycle().getId(), s.getOrgUnit());
            if (lock != null) locked.add(lock.getOrgUnit().getName());
        }
        if (!locked.isEmpty()) {
            throw new BusinessException(ErrorCode.FOLLOWING_UNITS_FINALIZED_CYCLE_DATA_F360_CANNOT, String.join(", ", locked));
        }
    }
}
