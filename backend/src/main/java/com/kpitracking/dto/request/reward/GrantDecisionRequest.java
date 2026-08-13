package com.kpitracking.dto.request.reward;

import lombok.Data;

/** Ghi chú kèm theo khi duyệt, từ chối, huỷ hoặc thu hồi một đề nghị thưởng. */
@Data
public class GrantDecisionRequest {

    private String note;

    /**
     * Chỉ dùng khi thu hồi. Bình thường hệ thống chặn thu hồi nếu có người nhận đã
     * tiêu hết số điểm đó, kèm danh sách ai không đủ số dư. Bật cờ này để thu hồi
     * bằng mọi giá — số dư của họ sẽ xuống âm, và đó là lựa chọn có ý thức của người
     * quản trị chứ không phải chuyện xảy ra âm thầm.
     */
    private Boolean force;
}
