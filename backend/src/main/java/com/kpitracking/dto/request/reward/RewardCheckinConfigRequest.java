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

    @NotNull(message = "Vui lòng cho biết bật hay tắt điểm danh")
    private Boolean enabled;

    @NotNull(message = "Vui lòng nhập số điểm mỗi lần điểm danh")
    @Min(value = 1, message = "Số điểm mỗi lần điểm danh phải lớn hơn 0")
    @Max(value = 100000, message = "Số điểm mỗi lần điểm danh quá lớn")
    private Integer pointsPerDay;

    /**
     * Để trống = chuỗi đếm thẳng không lặp. Từ 2 trở lên vì chu kỳ 1 ngày là vô nghĩa:
     * chuỗi sẽ luôn bằng 1 và mọi mốc thưởng trúng lại mỗi ngày.
     */
    @Min(value = 2, message = "Chu kỳ chuỗi phải từ 2 ngày trở lên")
    @Max(value = 366, message = "Chu kỳ chuỗi không được quá 366 ngày")
    private Integer streakCycleDays;

    @NotNull(message = "Vui lòng cho biết có tính thứ 7 và chủ nhật hay không")
    private Boolean skipWeekends;

    /** Để trống hoặc mảng rỗng = chỉ có điểm cơ bản, không có thưởng chuỗi. */
    @Valid
    private List<StreakBonus> streakBonuses;

    /** Chạm chuỗi đúng {@code day} ngày thì được cộng thêm {@code points} điểm. */
    @Data
    public static class StreakBonus {

        @NotNull(message = "Vui lòng nhập ngày của mốc thưởng")
        @Min(value = 1, message = "Ngày của mốc thưởng phải từ 1 trở lên")
        @Max(value = 366, message = "Ngày của mốc thưởng không được quá 366")
        private Integer day;

        @NotNull(message = "Vui lòng nhập số điểm thưởng của mốc")
        @Min(value = 1, message = "Điểm thưởng của mốc phải lớn hơn 0")
        @Max(value = 1000000, message = "Điểm thưởng của mốc quá lớn")
        private Integer points;
    }
}
