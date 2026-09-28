package com.kpitracking.dto.request.wallet;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class CreateTopupRequest {

    @NotNull(message = "{validation.enterTopUpAmount}")
    @Positive(message = "{validation.topUpAmountMustGreaterThan0}")
    private Long amount;
}
