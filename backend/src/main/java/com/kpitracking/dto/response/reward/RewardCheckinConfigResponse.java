package com.kpitracking.dto.response.reward;

import com.kpitracking.dto.request.reward.RewardCheckinConfigRequest;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RewardCheckinConfigResponse {

    /** Null khi tổ chức chưa từng lưu cấu hình — giao diện vẫn dựng form từ mặc định. */
    private UUID id;

    private Boolean enabled;
    private Integer pointsPerDay;
    private Integer streakCycleDays;
    private Boolean skipWeekends;
    private List<RewardCheckinConfigRequest.StreakBonus> streakBonuses;

    /** Số điểm tối đa một người có thể nhận trong trọn một chu kỳ, tính sẵn cho sếp ước lượng. */
    private Integer maxPointsPerCycle;

    // ── Số liệu vận hành, chỉ để đọc ───────────────────────────────
    /** Số người đã điểm danh hôm nay. */
    private Long checkedInToday;

    /** Tổng điểm đã phát qua điểm danh trong tháng này. */
    private Integer pointsThisMonth;
}
