package com.kpitracking.dto.request.reward;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Cấu hình điểm danh hàng ngày của tổ chức. Toàn bộ form là MỘT bản ghi nên đây vừa
 * là request tạo vừa là request sửa — không có id, service tự tìm cấu hình của tổ chức
 * đang đăng nhập rồi tạo mới hoặc ghi đè.
 */
@Data
public class RewardCheckinConfigRequest {

    @NotNull(message = "{validation.specifyWhetherCheckOff}")
    private Boolean enabled;

    @NotNull(message = "{validation.enterPointsPerCheck}")
    @Min(value = 1, message = "{validation.pointsPerCheckMustGreaterThan0}")
    @Max(value = 100000, message = "{validation.pointsPerCheckTooLarge}")
    private Integer pointsPerDay;

    /**
     * Để trống = chuỗi đếm thẳng không lặp. Từ 2 trở lên vì chu kỳ 1 ngày là vô nghĩa:
     * chuỗi sẽ luôn bằng 1 và mọi mốc thưởng trúng lại mỗi ngày.
     */
    @Min(value = 2, message = "{validation.streakCycleMust2DaysMore}")
    @Max(value = 366, message = "{validation.streakCycleCannotExceed366Days}")
    private Integer streakCycleDays;

    @NotNull(message = "{validation.specifyWhetherSaturdaySundayCount}")
    private Boolean skipWeekends;

    /** Để trống hoặc mảng rỗng = chỉ có điểm cơ bản, không có thưởng chuỗi. */
    @Valid
    private List<StreakBonus> streakBonuses;

    /** Chạm chuỗi đúng {@code day} ngày thì được cộng thêm {@code points} điểm. */
    @Data
    public static class StreakBonus {

        @NotNull(message = "{validation.enterMilestoneDay}")
        @Min(value = 1, message = "{validation.milestoneDayMust1More}")
        @Max(value = 366, message = "{validation.milestoneDayCannotExceed366}")
        private Integer day;

        @NotNull(message = "{validation.enterMilestoneRewardPoints}")
        @Min(value = 1, message = "{validation.milestoneRewardPointsMustGreaterThan0}")
        @Max(value = 1000000, message = "{validation.milestoneRewardPointsTooLarge}")
        private Integer points;
    }
}
