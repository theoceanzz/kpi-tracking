package com.kpitracking.service.reward.urbox;

import com.kpitracking.config.UrboxProperties;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.User;
import com.kpitracking.enums.GiftItemType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.service.reward.fulfillment.RewardFulfillmentProvider;
import com.kpitracking.service.reward.urbox.UrboxApiModels.UrboxOrder;
import com.kpitracking.service.reward.urbox.UrboxApiModels.UrboxVoucher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Xuất quà bằng cách đặt đơn sang kho eVoucher UrBox.
 *
 * <h2>Mã giao dịch phải suy ra được từ yêu cầu đổi</h2>
 * {@code transaction_id} gửi sang UrBox = mã yêu cầu đổi quà của KeyGo. UrBox coi nó là
 * khoá chống trùng: gọi lại đúng mã đó trả về ĐÚNG đơn cũ kèm mã quà đã xuất. Nhờ vậy
 * lần thử lại sau khi đứt mạng lấy được quà đã mua thay vì mua thêm một lần nữa. Sinh mã
 * ngẫu nhiên mỗi lần gọi sẽ biến mọi timeout thành một đơn hàng mất trắng.
 *
 * <h2>Ba kết cục, không phải hai</h2>
 * Thành công / bị từ chối / KHÔNG BIẾT. Cái thứ ba (timeout, đứt mạng) tuyệt đối không
 * được coi là thất bại: hoàn điểm lúc đó trong khi UrBox đã xuất voucher là vừa mất tiền
 * vừa mất hàng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UrboxFulfillmentProvider implements RewardFulfillmentProvider {

    /** Giá trị ghi ở {@code reward_gift_items.external_provider}. */
    public static final String PROVIDER = "URBOX";

    private final UrboxClient client;
    private final UrboxProperties props;

    @Override
    public boolean supports(GiftItemType type) {
        return type == GiftItemType.EXTERNAL_VOUCHER;
    }

    /** Voucher điện tử: người đổi cần thấy mã ngay trên màn hình, không ai phải bấm gì. */
    @Override
    public boolean fulfillsOnRedeem() {
        return true;
    }

    @Override
    public FulfillmentResult fulfill(RewardRedemption redemption) {
        RewardGiftItem gift = redemption.getGiftItem();

        if (!PROVIDER.equalsIgnoreCase(gift.getExternalProvider())) {
            return FulfillmentResult.rejected("Quà \"" + gift.getName()
                    + "\" được đánh dấu là quà ngoài nhưng không thuộc nhà cung cấp nào đã kết nối.");
        }
        if (gift.getExternalSku() == null || gift.getExternalSku().isBlank()) {
            return FulfillmentResult.rejected("Quà \"" + gift.getName()
                    + "\" thiếu mã quà UrBox. Hãy nhập lại món này từ kho quà UrBox.");
        }
        if (!props.isOrderConfigured()) {
            // Không hoàn điểm: đây là lỗi cấu hình của bản triển khai, sửa xong bấm lại là
            // đơn chạy tiếp. Hoàn điểm rồi bắt nhân viên đổi lại là bắt họ trả giá cho
            // một sự cố vận hành.
            return FulfillmentResult.unknown("Kết nối UrBox chưa được cấu hình đầy đủ "
                    + "(thiếu app_id / app_secret / campaign_code).");
        }

        User user = redemption.getUser();
        String transactionId = transactionIdOf(redemption.getId());

        try {
            UrboxOrder order = client.placeOrder(
                    user.getId().toString(),
                    transactionId,
                    List.of(new UrboxClient.OrderLine(gift.getExternalSku(), redemption.getQuantity(), null)),
                    user.getPhone(),
                    user.getEmail(),
                    user.getFullName());

            if (!order.paid()) {
                // pay = 1: UrBox nhận request nhưng không xuất được quà. Gọi lại đúng mã
                // này sẽ mãi trả pay = 1, nên đây là thất bại dứt khoát — hoàn điểm.
                log.warn("UrBox chưa xuất quà cho đơn {} (pay={})", transactionId, order.pay());
                return FulfillmentResult.rejected(
                        "UrBox không xuất được quà cho yêu cầu này. Điểm đã được hoàn lại, "
                                + "bạn có thể đổi lại hoặc chọn quà khác.");
            }

            List<UrboxVoucher> vouchers = order.cart() == null || order.cart().codeLinkGift() == null
                    ? List.of() : order.cart().codeLinkGift();
            if (vouchers.isEmpty()) {
                // Đơn báo đã thanh toán mà không có mã nào là mâu thuẫn. KHÔNG hoàn điểm:
                // tiền có thể đã trừ bên UrBox, phải để người vận hành tra lại đơn.
                log.error("UrBox báo đã thanh toán nhưng không trả mã quà, đơn {}", transactionId);
                return FulfillmentResult.unknown("UrBox báo đơn thành công nhưng chưa trả mã quà. "
                        + "Bộ phận vận hành sẽ tra lại đơn " + transactionId + ".");
            }

            String cartNo = order.cart() == null ? null : order.cart().cartNo();
            return FulfillmentResult.success(cartNo, buildPayload(order, vouchers));

        } catch (UrboxClient.UrboxUnreachableException e) {
            log.error("Mất kết nối UrBox khi đặt đơn {}", transactionId, e);
            return FulfillmentResult.unknown("Chưa nhận được phản hồi từ UrBox. Yêu cầu đang được "
                    + "giữ nguyên, hệ thống sẽ lấy lại quà bằng đúng mã giao dịch này.");
        } catch (UrboxRejectedException e) {
            // Hết code, hết hạn, rời khỏi chương trình — món quà hỏng chứ không phải đơn
            // hàng xui. Để nguyên trong cửa hàng thì người tiếp theo cũng đổi hụt y hệt.
            if (e.giftUnavailable()) {
                log.warn("Quà UrBox {} không còn xuất được (mã {}), sẽ ẩn khỏi cửa hàng: {}",
                        gift.getExternalSku(), e.getCode(), e.getMessage());
                // Nguyên văn của UrBox là "vui lòng bỏ sản phẩm ra khỏi giỏ hàng" — câu
                // đó nói với hệ thống của họ, không nói với nhân viên đang đứng trước một
                // màn hình chẳng có giỏ hàng nào. Giữ mã lỗi lại cho người vận hành tra.
                return FulfillmentResult.giftGone("Món quà này vừa hết ở nhà cung cấp nên chưa "
                        + "xuất được mã. Quà đã được tạm ẩn khỏi cửa hàng. (UrBox mã "
                        + e.getCode() + ")");
            }
            return FulfillmentResult.rejected(e.getMessage());
        } catch (BusinessException e) {
            return FulfillmentResult.rejected(e.getMessage());
        }
    }

    /**
     * Mã giao dịch gửi UrBox. Suy ra từ mã yêu cầu đổi quà nên lần thử lại nào cũng ra
     * đúng một chuỗi — đó chính là thứ khiến UrBox trả về đơn cũ thay vì tạo đơn mới.
     */
    public static String transactionIdOf(UUID redemptionId) {
        return "KG" + redemptionId.toString().replace("-", "");
    }

    /**
     * Gói phần cần HIỂN THỊ cho người đổi. Cố ý không lưu nguyên response: phần lớn là
     * trường nội bộ của UrBox, giữ lại chỉ làm phình cột jsonb và tạo cảm giác có thể
     * dựa vào những trường không ai kiểm chứng.
     */
    private Map<String, Object> buildPayload(UrboxOrder order, List<UrboxVoucher> vouchers) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (UrboxVoucher v : vouchers) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", v.code());
            item.put("pin", blankToNull(v.pin()));
            item.put("serial", blankToNull(v.serial()));
            item.put("link", v.link());
            item.put("codeImage", v.codeImage());
            item.put("codeDisplay", v.codeDisplay());
            item.put("codeDisplayType", v.codeDisplayType());
            item.put("expired", v.expired());
            items.add(item);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("provider", PROVIDER);
        payload.put("cartNo", order.cart() == null ? null : order.cart().cartNo());
        payload.put("linkCart", order.linkCart());
        payload.put("vouchers", items);
        return payload;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
