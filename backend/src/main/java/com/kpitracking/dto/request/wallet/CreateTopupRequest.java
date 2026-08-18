package com.kpitracking.dto.request.wallet;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class CreateTopupRequest {

    @NotNull(message = "Vui lòng nhập số tiền muốn nạp")
    @Positive(message = "Số tiền nạp phải lớn hơn 0")
    private Long amount;
}
