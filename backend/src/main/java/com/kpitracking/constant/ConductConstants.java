package com.kpitracking.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

/**
 * Bộ tiêu chí hạnh kiểm mặc định — 4 tiêu chí, mỗi tiêu chí 25%, theo phiếu
 * "Đánh giá xếp loại hành vi theo triết lý giáo dục". Tổ chức sửa/thêm/bớt tự do sau đó.
 */
public final class ConductConstants {

    private ConductConstants() {}

    /** Thang điểm mỗi tiêu chí khi tổ chức chưa cấu hình. */
    public static final double DEFAULT_MAX_SCORE = 4.0;

    @Getter
    @AllArgsConstructor
    public static class DefaultConductCriteria {
        private final String name;
        private final String description;
        private final double weight;
        private final int position;
    }

    public static final List<DefaultConductCriteria> DEFAULT_CRITERIA = List.of(
        new DefaultConductCriteria("Trung thực", """
            Ngay thẳng, thật thà, dám nói lên sự thật.
            Tôn trọng lẽ phải, không gian dối từ lời nói đến hành vi.
            Sẵn sàng dũng cảm nói lên sự thật và sẵn sàng nhận lỗi khi phạm sai lầm.
            Khiêm tốn với khả năng của bản thân, thể hiện sự chính trực, đặt lợi ích chung lên hàng đầu, không vụ lợi.""",
            25.0, 1),
        new DefaultConductCriteria("Nhân ái", """
            Chia sẻ, cảm thông cho nhau những lúc hoạn nạn, khó khăn.
            Sẵn sàng giúp đỡ, thấu hiểu người khác dù trong bất kỳ hoàn cảnh nào, sống chan hoà.
            Không gây bè phái, hiềm khích, hiểu lầm cá nhân, không làm ảnh hưởng tới văn hoá và truyền thống giáo dục của Nhà trường.""",
            25.0, 2),
        new DefaultConductCriteria("Trách nhiệm", """
            Luôn hoàn thành nhiệm vụ được giao đúng thời hạn.
            Có tính kỷ luật cao, luôn lập kế hoạch thực hiện công việc của mình.
            Có trách nhiệm với mọi công việc được giao.
            Không đổ lỗi, luôn lắng nghe ý kiến đóng góp để hoàn thiện bản thân và công việc.""",
            25.0, 3),
        new DefaultConductCriteria("Học tập suốt đời", """
            Học bất cứ lúc nào, ở đâu, luôn duy trì việc học ngay cả khi đã đạt được những thành tựu, mục tiêu trong cuộc sống, miễn là khi có điều kiện thuận lợi, đặc biệt là còn sức khoẻ.
            Chủ động nâng cao nhận thức, trình độ; phải học tập, tự học tập, học tập thường xuyên.
            Sẵn sàng đón nhận và tiếp thu những kiến thức, kỹ năng mới. Không ngừng "thay và sửa", áp dụng những kiến thức tiên tiến vào quá trình công tác, làm việc.""",
            25.0, 4)
    );
}
