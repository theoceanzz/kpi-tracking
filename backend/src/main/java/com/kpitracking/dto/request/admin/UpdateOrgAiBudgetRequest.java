package com.kpitracking.dto.request.admin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateOrgAiBudgetRequest {

    @NotNull(message = "Vui lòng nhập ngân sách token")
    @Min(value = 0, message = "Ngân sách không được là số âm")
    private Long aiMonthlyTokenLimit;
}
