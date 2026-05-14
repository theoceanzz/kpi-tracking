package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiPeriodRequest {

    @NotBlank(message = "Tên đợt không được để trống")
    private String name;

    @NotNull(message = "Loại kỳ không được để trống")
    private KpiFrequency periodType;

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private Instant startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private Instant endDate;

    private Instant notificationDate;

    private UUID organizationId;
}
