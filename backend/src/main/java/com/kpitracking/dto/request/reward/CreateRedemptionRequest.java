package com.kpitracking.dto.request.reward;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateRedemptionRequest {

    @NotNull(message = "Vui lòng chọn quà muốn đổi")
    private UUID giftItemId;

    @NotNull(message = "Vui lòng nhập số lượng")
    @Min(value = 1, message = "Số lượng phải lớn hơn 0")
    private Integer quantity;

    private String note;
}
