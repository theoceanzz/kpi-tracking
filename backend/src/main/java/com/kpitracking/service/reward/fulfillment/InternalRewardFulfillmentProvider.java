package com.kpitracking.service.reward.fulfillment;

import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.enums.GiftItemType;
import org.springframework.stereotype.Component;

/**
 * Quà nội bộ: tổ chức tự trao tay, hệ thống chỉ ghi nhận.
 *
 * <p>Không làm gì là ĐÚNG với loại quà này — nhưng vẫn phải đi qua interface để
 * {@code RewardRedemptionService} không cần biết loại quà nào cần gọi ra ngoài,
 * loại nào không.
 */
@Component
public class InternalRewardFulfillmentProvider implements RewardFulfillmentProvider {

    @Override
    public boolean supports(GiftItemType type) {
        return type == GiftItemType.INTERNAL;
    }

    @Override
    public FulfillmentResult fulfill(RewardRedemption redemption) {
        return FulfillmentResult.success();
    }
}
