package com.kpitracking.service.feedback360;

import com.kpitracking.entity.F360Campaign;
import com.kpitracking.entity.F360Subject;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360ScoringMode;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import com.kpitracking.util.BehaviorAxisResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Mặt tiền 360 cho đánh giá kỳ (§7.2): điểm 360 của một danh sách người trong một kỳ, đã quy về
 * thang 1..5 của trục hành vi. Nạp THEO LÔ giống {@code ConductService.effectiveAxes} — tổng hợp
 * phòng ban gọi cho cả phòng một lần.
 *
 * Chỉ lấy chiến dịch ĐÃ ĐÓNG/CÔNG BỐ, có ảnh hưởng điểm, của đúng kỳ, và tổ chức đang cho phép 360
 * ảnh hưởng xếp loại. Không có chiến dịch như vậy ⇒ map rỗng ⇒ đánh giá kỳ chạy y như trước.
 */
@Service
@RequiredArgsConstructor
public class Feedback360Service {

    private final F360CampaignRepository campaignRepository;
    private final F360SubjectRepository subjectRepository;

    /** Điểm 360 của một người + chế độ trộn của chiến dịch. */
    public record Axis(Double score, F360ScoringMode mode, Integer blendConductPercent) {
        public static final Axis EMPTY = new Axis(null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<UUID, Axis> effectiveScores(Collection<UUID> userIds, KpiCycle cycle) {
        if (cycle == null || userIds == null || userIds.isEmpty()) return Map.of();
        List<F360Campaign> campaigns = campaignRepository.findScoringByCycle(cycle.getId(),
                List.of(F360CampaignStatus.CLOSED, F360CampaignStatus.RELEASED));
        Map<UUID, Axis> out = new HashMap<>();
        Set<UUID> wanted = new HashSet<>(userIds);
        for (F360Campaign c : campaigns) {
            if (!F360CycleGuard.affectsRating(c)) continue;
            for (F360Subject s : subjectRepository.findByCampaignIdWithUser(c.getId())) {
                UUID uid = s.getUser().getId();
                if (!wanted.contains(uid) || s.getOverallScore() == null) continue;
                out.putIfAbsent(uid, new Axis(
                        BehaviorAxisResolver.normalize360(s.getOverallScore(), c.getScaleMax()),
                        c.getScoringMode(), c.getBlendConductPercent()));
            }
        }
        return out;
    }
}
