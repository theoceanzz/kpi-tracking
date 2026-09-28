package com.kpitracking.dto.request.reward;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateRedemptionRequest {

    @NotNull(message = "{validation.chooseGiftRedeem}")
    private UUID giftItemId;

    @NotNull(message = "{validation.enterQuantity}")
    @Min(value = 1, message = "{validation.quantityMustGreaterThan0}")
    private Integer quantity;

    private String note;
}
