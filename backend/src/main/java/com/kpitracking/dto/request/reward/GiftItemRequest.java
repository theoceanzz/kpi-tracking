package com.kpitracking.dto.request.reward;

import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.GiftItemType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GiftItemRequest {

    @NotBlank(message = "{validation.enterGiftName}")
    private String name;

    private String description;

    private String imageUrl;

    @NotNull(message = "{validation.enterPointsNeededRedeem}")
    @Min(value = 1, message = "{validation.redemptionPointsMustGreaterThan0}")
    private Integer pointCost;

    /** Bỏ qua khi {@link #unlimitedStock} bật. */
    @Min(value = 0, message = "{validation.stockCannotNegative}")
    private Integer stockQuantity;

    private Boolean unlimitedStock;

    /**
     * Quà có cần người trao tận tay không. Mặc định có.
     *
     * <p>Tắt cho quà nhận ngay (ngày nghỉ phép, quyền lợi tự động) — yêu cầu đổi sẽ tự
     * hoàn tất, không tạo việc cho ai.
     */
    private Boolean requiresDelivery;

    /**
     * v1 giao diện chỉ cho tạo {@code INTERNAL}. Giá trị {@code EXTERNAL_VOUCHER} đã có
     * sẵn trong enum và ràng buộc DB để sau này bật lên không phải sửa migration.
     */
    private GiftItemType type;

    private GiftItemStatus status;

    private Integer displayOrder;
}
