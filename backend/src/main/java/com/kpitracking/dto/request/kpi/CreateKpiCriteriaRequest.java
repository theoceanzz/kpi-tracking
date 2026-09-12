package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateKpiCriteriaRequest {

    @NotBlank(message = "KPI name is required")
    @Size(max = 255, message = "KPI name must not exceed 255 characters")
    private String name;

    private KpiType kpiType;

    private String description;

    private Double weight;

    private Double targetValue;

    private String unit;

    @NotNull(message = "Frequency is required")
    private KpiFrequency frequency;

    private UUID orgUnitId;

    private java.util.List<UUID> orgUnitIds;

    private UUID assignedToId;

    private java.util.List<UUID> assignedToIds;

    @NotNull(message = "KPI Period is required")
    private UUID kpiPeriodId;

    private Double minimumValue;
    private Boolean isReverseKpi;
    private Boolean isBonusKpi;
    private Instant deadline;
    private UUID keyResultId;
    private UUID parentId;
    private KpiParentRelationType parentRelationType;
    private UUID perspectiveId;

    /**
     * Dòng chỉ tiêu CỤ THỂ của bộ tiêu chí BSC mà KPI này bám vào (docs/bsc-cascade-design.md).
     * Cụ thể hơn {@link #perspectiveId}: cùng một hạng mục xuất hiện ở nhiều bộ tiêu chí với mục
     * tiêu khác nhau. Đây cũng là căn cứ đo tỉ lệ trọng số KPI liên kết BSC (QĐ-8).
     */
    private UUID scorecardPerspectiveId;
}
