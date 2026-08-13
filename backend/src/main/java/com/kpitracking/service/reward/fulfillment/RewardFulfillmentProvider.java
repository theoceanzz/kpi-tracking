package com.kpitracking.service.reward.fulfillment;

import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.enums.GiftItemType;

import java.util.Map;

/**
 * Cách một món quà được giao tới tay người đổi.
 *
 * <p>v1 chỉ có {@link InternalRewardFulfillmentProvider} — quà nội bộ, tổ chức tự trao
 * tay, hệ thống chỉ ghi nhận trạng thái. Interface tồn tại từ bây giờ để khi nối sàn
 * quà tặng hay ví điện tử thì chỉ thêm một bean mới, không phải mổ
 * {@code RewardRedemptionService}.
 *
 * <p>CỐ Ý chưa có: HTTP client, khoá cấu hình, endpoint webhook. Chừa chỗ khác với làm sẵn —
 * code chết không ai chạy sẽ mục đi trước khi kịp dùng đến.
 */
public interface RewardFulfillmentProvider {

    boolean supports(GiftItemType type);

    /**
     * Thực hiện giao quà. Được gọi khi người quản lý đánh dấu ĐÃ GIAO.
     *
     * <p>Không được ném lỗi để làm hỏng transaction của việc đổi trạng thái: quà đã
     * trao tay rồi mà hệ thống ngoài lỗi thì vẫn phải ghi nhận là đã giao. Trả về
     * {@code ok = false} kèm thông điệp để lưu lại và xử lý sau.
     */
    FulfillmentResult fulfill(RewardRedemption redemption);

    /** Huỷ ở hệ thống ngoài, nếu có. Mặc định không làm gì. */
    default void cancel(RewardRedemption redemption) {
        // Quà nội bộ không có gì để huỷ ở bên ngoài.
    }

    record FulfillmentResult(boolean ok, String externalRef, String message, Map<String, Object> payload) {
        public static FulfillmentResult success() {
            return new FulfillmentResult(true, null, null, null);
        }
    }
}
