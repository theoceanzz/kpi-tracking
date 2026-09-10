package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.KpiFrequency;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Một ĐỢT trong bản kế hoạch chia chỉ tiêu BSC thành KPI, kèm phần đã chia sẵn ở đợt đó.
 *
 * <p>Con số "đã chia" đếm theo đúng luật mà kết quả BSC của đơn vị dùng để cộng KPI vào chỉ tiêu
 * ({@code BscCascadeService.kpisOfRow}) — nếu đếm khác đi thì màn chia số nói một đằng, điểm BSC
 * tính một nẻo.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscKpiPlanPeriodResponse {
    private UUID kpiPeriodId;
    private String name;
    private KpiFrequency periodType;
    private Instant startDate;
    private Instant endDate;
    /** Tổng mục tiêu của các KPI đã gắn chỉ tiêu này trong đợt. */
    private Double allocatedValue;
    /** Tổng trọng số (%) của các KPI đó — dùng để nhắc "còn thiếu bao nhiêu cho đủ 100%". */
    private Double allocatedWeight;
    private int kpiCount;
}
