package com.kpitracking.dto.response.kpi.lock;

import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleLockResultResponse {
    private KpiCycleResponse cycle;
    /** Đợt chuyển nguyên sang kỳ khác. */
    private int transferredPeriods;
    /** Đợt bị tách (phần dở sang kỳ khác). */
    private int splitPeriods;
    private int closedPeriods;
    private int cancelledPeriods;
    /** KPI chuyển sang kỳ khác (cả chuyển nguyên lẫn tách). */
    private int movedKpis;
    /** KPI bị chốt CLOSED_BY_LOCK. */
    private int closedKpis;
    /** KPI nháp bị xoá mềm khi huỷ đợt. */
    private int deletedDraftKpis;
}
