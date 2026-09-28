package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiPeriodResponse {
    private UUID id;
    private String name;
    private KpiFrequency periodType;
    private Instant startDate;
    private Instant endDate;
    private Instant notificationDate;
    private UUID organizationId;
    /** Kỳ đánh giá tổng hợp chứa đợt này (null nếu chưa gán). */
    private UUID cycleId;
    private String cycleName;
    /** Trạng thái kỳ chứa đợt (OPEN | LOCKED) — giao diện dùng để khoá nút. */
    private com.kpitracking.enums.KpiCycleStatus cycleStatus;
    /** ACTIVE | CLOSED_BY_LOCK | TRANSFERRED | CANCELLED. */
    private com.kpitracking.enums.KpiPeriodStatus status;
    /** Đợt sinh ra khi tách: đợt gốc ở kỳ cũ. */
    private UUID sourcePeriodId;
    /** Đợt bị tách: kỳ nhận phần KPI dở. */
    private UUID transferredToCycleId;
}
