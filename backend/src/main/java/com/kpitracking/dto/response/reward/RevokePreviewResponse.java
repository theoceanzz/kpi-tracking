package com.kpitracking.dto.response.reward;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Hậu quả của việc thu hồi một đề nghị thưởng, tính TRƯỚC khi thực hiện.
 *
 * <p>Thu hồi là thao tác không hoàn tác được (ghi thẳng vào sổ cái), và có thể đẩy số dư
 * của nhân viên xuống âm nếu họ đã tiêu điểm. Người quản trị phải nhìn thấy chính xác
 * ai bị ảnh hưởng và ảnh hưởng bao nhiêu trước khi bấm — không thể chỉ đưa một câu
 * cảnh báo chung chung rồi bắt họ đoán.
 */
@Data
@Builder
public class RevokePreviewResponse {

    private UUID grantId;
    private Integer totalPoints;

    /** Có ai sẽ bị âm số dư không — để giao diện đổi mức độ cảnh báo. */
    private Boolean anyGoesNegative;

    private List<Item> items;

    @Data
    @Builder
    public static class Item {
        private UUID userId;
        private String fullName;
        private String email;
        /** Số điểm sẽ bị trừ lại của người này. */
        private Integer points;
        private Integer currentBalance;
        private Integer balanceAfter;
        private Boolean goesNegative;
    }
}
