package com.kpitracking.dto.response.reward;

import com.kpitracking.dto.request.reward.RewardCheckinConfigRequest;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * Mọi thứ màn hình nhân viên cần để vẽ thẻ điểm danh trong MỘT lượt gọi: bật hay tắt,
 * hôm nay bấm được chưa, chuỗi đang bao nhiêu, bấm bây giờ được mấy điểm.
 *
 * <p>Gộp vào một response thay vì để giao diện tự suy từ cấu hình + lịch sử: luật chuỗi
 * (bỏ qua cuối tuần, quay vòng theo chu kỳ) chỉ nên tồn tại ở MỘT nơi, nếu chép sang
 * TypeScript thì hai bên sẽ lệch nhau và nhân viên thấy số điểm khác lúc bấm.
 */
@Data
@Builder
public class RewardCheckinStatusResponse {

    /**
     * Người này có điểm danh được không. Tắt thì giao diện ẩn hẳn thẻ — tổ chức chưa bật
     * tính năng, hoặc người xem thuộc nhóm được miễn ({@link #exempt}).
     */
    private Boolean enabled;

    /**
     * Được miễn điểm danh vì là lãnh đạo cao nhất của công ty (trưởng/phó tại đơn vị gốc).
     * Kèm theo {@code enabled = false} nên giao diện không cần biết luật này; trường ở đây
     * để phân biệt "miễn" với "tổ chức chưa bật" khi cần hiển thị lý do.
     */
    private Boolean exempt;

    /** Ngày "hôm nay" theo múi giờ Asia/Ho_Chi_Minh — máy người dùng có thể lệch múi giờ. */
    private LocalDate today;

    private Boolean checkedInToday;

    /** Điểm đã nhận hôm nay. Null khi chưa điểm danh. */
    private Integer todayPoints;

    /** Bấm điểm danh bây giờ được không. False kèm {@link #blockedReason}. */
    private Boolean canCheckin;

    /** Vì sao chưa bấm được: cuối tuần, đã điểm danh, hoặc tính năng đang tắt. */
    private String blockedReason;

    /**
     * Chuỗi ĐÃ THỰC SỰ đạt được, không phải chuỗi sắp đạt. Chưa điểm danh hôm nay mà
     * hôm qua có thì đây là con số của hôm qua; đứt chuỗi thì bằng 0. Trả về con số sắp
     * đạt sẽ là hứa trước phần thưởng người ta chưa bấm để lấy — dùng
     * {@link #nextStreakLength} cho việc đó.
     */
    private Integer streakLength;

    /** Chuỗi mà lần bấm sắp tới sẽ đạt. Null khi hôm nay không còn lần bấm nào. */
    private Integer nextStreakLength;

    /** Vị trí trong chu kỳ (1..{@link #streakCycleDays}) của lần bấm đang xét. */
    private Integer streakDay;

    private Integer streakCycleDays;

    /** Điểm cơ bản + thưởng mốc nếu bấm điểm danh ngay bây giờ. Null khi không bấm được. */
    private Integer nextPoints;

    /** Phần thưởng mốc trong {@link #nextPoints}. 0 nghĩa là ngày mai/hôm nay không trúng mốc. */
    private Integer nextBonusPoints;

    private Integer pointsPerDay;

    /** Các mốc thưởng đang áp dụng, để vẽ dải "ngày 3 +20, ngày 7 +100". */
    private List<RewardCheckinConfigRequest.StreakBonus> streakBonuses;

    /** Tổng điểm đã nhận từ điểm danh trong tháng này. */
    private Integer pointsThisMonth;

    /** Lịch gần đây để vẽ dải chấm, cũ nhất trước. */
    private List<Day> recentDays;

    @Data
    @Builder
    public static class Day {
        private LocalDate date;
        private Boolean checkedIn;
        /** Ngày nghỉ theo cấu hình — vẽ mờ thay vì vẽ như một ngày bị bỏ lỡ. */
        private Boolean restDay;
        /** Điểm nhận được hôm đó. Null khi không điểm danh. */
        private Integer points;
    }
}
