package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.bsc.BscUnitResultStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Kết quả BSC của một đơn vị trong một đợt. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UnitResultResponse {
    private UUID id;
    private UUID scorecardId;
    private String scorecardName;
    private String orgUnitName;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private Double achievementPercent;
    private Boolean gatePassed;
    private String gateFailedItems;
    private BscUnitResultStatus status;
    private String finalizedByName;
    private Instant finalizedAt;
    private List<UnitResultItemResponse> items;
    /** Đã chốt theo số tạm tính của thẻ nguồn (quản trị cho phép). */
    private Boolean provisionalSource;
    /** Yêu cầu chốt đang chờ duyệt theo quy trình "Chốt kết quả thẻ điểm đơn vị". */
    private com.kpitracking.dto.response.kpi.approval.ApprovalSummaryResponse approval;
}
