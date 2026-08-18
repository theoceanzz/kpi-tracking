package com.kpitracking.service.reward.fulfillment;

import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.enums.GiftItemType;

import java.util.Map;

/**
 * Cách một món quà được giao tới tay người đổi.
 *
 * <p>{@link InternalRewardFulfillmentProvider} là quà nội bộ — tổ chức tự trao tay, hệ
 * thống chỉ ghi nhận trạng thái. {@code UrboxFulfillmentProvider} đặt đơn sang kho quà
 * eVoucher UrBox và nhận về mã voucher thật.
 *
 * <h2>Gọi NGOÀI transaction</h2>
 * Hiện thực có thể gọi HTTP ra ngoài, mất tới hàng chục giây. Người gọi phải commit phần
 * ghi sổ TRƯỚC, gọi hàm này SAU, rồi mới ghi kết quả bằng một transaction khác — giữ
 * transaction mở suốt một cuộc gọi mạng là cách nhanh nhất để cạn pool kết nối.
 */
public interface RewardFulfillmentProvider {

    boolean supports(GiftItemType type);

    /**
     * Quà loại này có được xuất NGAY lúc người dùng bấm đổi không.
     *
     * <p>{@code true} với voucher điện tử: người đổi cần mã ngay trên màn hình, không ai
     * phải bấm gì. {@code false} với quà nội bộ — chỉ chạy khi người quản lý đánh dấu đã
     * trao tay.
     */
    default boolean fulfillsOnRedeem() {
        return false;
    }

    /**
     * Thực hiện giao quà.
     *
     * <p>KHÔNG được ném lỗi. Mọi thất bại phải trả về qua {@link FulfillmentResult} kèm
     * {@code retryable} nói rõ đây là "chắc chắn hỏng" hay "không biết" — hai ca đó dẫn
     * tới hai xử lý trái ngược nhau: hoàn điểm ngay, hay giữ nguyên chờ thử lại.
     */
    FulfillmentResult fulfill(RewardRedemption redemption);

    /** Huỷ ở hệ thống ngoài, nếu có. Mặc định không làm gì. */
    default void cancel(RewardRedemption redemption) {
        // Quà nội bộ không có gì để huỷ ở bên ngoài.
    }

    /**
     * @param ok               xuất quà thành công
     * @param retryable        chỉ có nghĩa khi {@code ok = false}. {@code true} = KHÔNG BIẾT
     *                         đơn đã tạo bên kia hay chưa (đứt mạng, timeout) ⇒ giữ nguyên
     *                         yêu cầu, chờ thử lại bằng đúng mã giao dịch cũ. {@code false} =
     *                         nhà cung cấp từ chối dứt khoát ⇒ hoàn điểm ngay.
     * @param giftUnavailable  món quà này hỏng vĩnh viễn ở phía nhà cung cấp (hết code, hết
     *                         hạn, rời khỏi chương trình) ⇒ mọi lượt đổi sau cũng hỏng y hệt,
     *                         phải rút khỏi cửa hàng thay vì để người tiếp theo vấp lại.
     */
    record FulfillmentResult(boolean ok, boolean retryable, boolean giftUnavailable,
                             String externalRef, String message, Map<String, Object> payload) {

        public static FulfillmentResult success() {
            return new FulfillmentResult(true, false, false, null, null, null);
        }

        public static FulfillmentResult success(String externalRef, Map<String, Object> payload) {
            return new FulfillmentResult(true, false, false, externalRef, null, payload);
        }

        /** Nhà cung cấp từ chối dứt khoát — không có đơn nào được tạo. */
        public static FulfillmentResult rejected(String message) {
            return new FulfillmentResult(false, false, false, null, message, null);
        }

        /** Từ chối, VÀ món quà này sẽ còn hỏng mãi ⇒ ẩn khỏi cửa hàng luôn. */
        public static FulfillmentResult giftGone(String message) {
            return new FulfillmentResult(false, false, true, null, message, null);
        }

        /** Không biết kết quả. Tuyệt đối không hoàn điểm dựa trên kết quả này. */
        public static FulfillmentResult unknown(String message) {
            return new FulfillmentResult(false, true, false, null, message, null);
        }
    }
}
