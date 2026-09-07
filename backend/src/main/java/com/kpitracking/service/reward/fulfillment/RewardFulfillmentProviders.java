package com.kpitracking.service.reward.fulfillment;

import com.kpitracking.enums.GiftItemType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Tra kênh giao quà theo loại quà.
 *
 * <p>Gom vào một chỗ vì cả lúc TẠO yêu cầu (để biết có nên chờ hệ thống ngoài không) lẫn
 * lúc GIAO đều cần phép tra này. Chép hai lần là hai chỗ có thể lệch khi thêm nhà cung
 * cấp mới — và khi lệch thì yêu cầu đổi sẽ tự đóng ở trạng thái "đã giao" trong lúc chưa
 * ai xuất quà.
 */
@Component
@RequiredArgsConstructor
public class RewardFulfillmentProviders {

    private final List<RewardFulfillmentProvider> providers;

    public Optional<RewardFulfillmentProvider> find(GiftItemType type) {
        return providers.stream().filter(p -> p.supports(type)).findFirst();
    }

    /** Loại quà này có được xuất ngay lúc người dùng bấm đổi không. */
    public boolean fulfillsOnRedeem(GiftItemType type) {
        return find(type).map(RewardFulfillmentProvider::fulfillsOnRedeem).orElse(false);
    }
}
