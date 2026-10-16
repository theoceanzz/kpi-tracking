package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một đợt KPI mà bộ tiêu chí áp dụng (id + tên để hiển thị; ngày để màn kết quả mở đúng đợt đang chạy). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPeriodResponse {
    private UUID id;
    private String name;
    private Instant startDate;
    private Instant endDate;
}
