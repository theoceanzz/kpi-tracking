package com.kpitracking.service;

import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.enums.BscUnitResultStatus;
import com.kpitracking.repository.BscUnitResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Điểm của dòng "Kết quả cấp trên" (phân rã cả bộ tiêu chí): kết quả TỔNG của thẻ nguồn trong cùng
 * đợt, đọc từ bản đã lưu ({@code bsc_unit_results.achievement_percent}).
 *
 * <p>Lấy đúng con số cuối cùng của thẻ nguồn — không tự áp thêm trần, không kế thừa trần xếp loại
 * của hạng mục chặn — để hai màn hình không bao giờ lệch nhau. Chỉ ĐỌC, không tự tính lại thẻ
 * nguồn: nhờ vậy chấm điểm không bao giờ đệ quy lên cây (tổ → phòng → công ty) và dữ liệu lỗi
 * cũng không thể làm treo một lần chấm.
 */
@Component
@RequiredArgsConstructor
public class BscSourceScores {

    private final BscUnitResultRepository unitResultRepository;

    /**
     * @param percent   %đạt tổng của thẻ nguồn; null = thẻ nguồn chưa tính kết quả đợt này
     * @param finalized thẻ nguồn đã chốt kết quả đợt này chưa (chưa ⇒ số tạm tính)
     */
    public record SourceScore(UUID sourceId, String sourceName, Double percent, boolean finalized) {}

    /** Thẻ nguồn của một dòng; null = dòng bình thường. */
    public static BscScorecard sourceOf(BscScorecardPerspective row) {
        BscPerspective p = row.getPerspective();
        return p != null ? p.getSourceScorecard() : null;
    }

    public static boolean isFinalized(BscUnitResultStatus status) {
        return status == BscUnitResultStatus.FINALIZED || status == BscUnitResultStatus.LOCKED;
    }

    /**
     * Nạp một lượt kết quả đợt của mọi thẻ nguồn mà các dòng này trỏ tới. Thẻ nguồn chưa có kết quả
     * vẫn có mặt trong map (percent = null, finalized = false) để nơi gọi nói được tên nó.
     */
    public Map<UUID, SourceScore> load(Collection<BscScorecardPerspective> rows, UUID kpiPeriodId) {
        Map<UUID, String> names = new HashMap<>();
        for (BscScorecardPerspective row : rows) {
            BscScorecard source = sourceOf(row);
            if (source != null) names.put(source.getId(), source.getName());
        }
        Map<UUID, SourceScore> out = new HashMap<>();
        if (names.isEmpty() || kpiPeriodId == null) {
            names.forEach((id, name) -> out.put(id, new SourceScore(id, name, null, false)));
            return out;
        }
        Set<UUID> missing = new HashSet<>(names.keySet());
        for (BscUnitResult r : unitResultRepository.findByScorecardIdInAndKpiPeriodId(names.keySet(), kpiPeriodId)) {
            UUID id = r.getScorecard().getId();
            out.put(id, new SourceScore(id, names.get(id), r.getAchievementPercent(), isFinalized(r.getStatus())));
            missing.remove(id);
        }
        for (UUID id : missing) out.put(id, new SourceScore(id, names.get(id), null, false));
        return out;
    }
}
