package com.kpitracking.dto.response.reward;

import lombok.*;

/**
 * Điểm phát ra / tiêu đi của MỘT tháng.
 *
 * <p>Tháng không có giao dịch vẫn được trả về với số 0, để biểu đồ không bị đứt quãng
 * và người đọc thấy rõ "tháng đó thật sự không ai thưởng" thay vì "thiếu dữ liệu".
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardMonthlySummaryResponse {

    /** Dạng {@code yyyy-MM}, sắp xếp tăng dần theo thời gian. */
    private String month;
    private long earned;
    private long spent;
}
