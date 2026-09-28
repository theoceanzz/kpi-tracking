package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Phần chia của MỘT đợt khi tạo KPI từ một dòng chỉ tiêu BSC. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscKpiAllocationRequest {

    @NotNull(message = "{validation.choosePeriodEachSplitRow}")
    private UUID kpiPeriodId;

    /** Bỏ trống ⇒ lấy "{tên hạng mục} — {tên đợt}". */
    private String name;

    @NotNull(message = "{validation.enterTargetEachPeriod}")
    private Double targetValue;

    private Double minimumValue;

    @NotNull(message = "{validation.enterWeightEachPeriod}")
    private Double weight;

    /** Bỏ trống ⇒ theo loại của đợt (tần suất chốt không được lớn hơn độ dài đợt). */
    private KpiFrequency frequency;

    private Instant deadline;
}
