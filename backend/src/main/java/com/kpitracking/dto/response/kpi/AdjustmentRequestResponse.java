package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AdjustmentRequestResponse {
    private UUID id;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private KpiType kpiType;
    private String perspectiveName;
    private String perspectiveColor;
    /** %hạng_mục từ bộ tiêu chí của đơn vị KPI (để FE tính trọng số THẬT = weight × %/100). Null nếu không áp dụng. */
    private Double categoryWeightPercent;
    private Double currentTargetValue;
    private Double currentWeight;
    private Double currentMinimumValue;
    private Double requestedTargetValue;
    private Double requestedMinimumValue;
    private boolean deactivationRequest;
    private Double compensationPercentage;
    private String reason;
    private AdjustmentStatus status;
    /** Đơn vị của KPI bị điều chỉnh — FE gom danh sách theo Đơn vị → Người → Yêu cầu. */
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID requesterId;
    private String requesterName;
    private UUID reviewerId;
    private String reviewerName;
    private String reviewerNote;
    private Instant createdAt;
    private Instant updatedAt;
}
