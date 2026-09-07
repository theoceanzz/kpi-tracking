package com.kpitracking.util;

import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.KpiCriteria;

import java.util.UUID;

/**
 * Nguồn chân lý DUY NHẤT cho "lĩnh vực hiệu lực" của một KPI.
 *
 * Quy tắc: lĩnh vực gán TRỰC TIẾP trên KPI được ưu tiên; nếu chưa gán thì SUY từ lĩnh vực
 * của Objective cha (KPI → KeyResult → Objective → perspective).
 *
 * Dùng chung bởi BscScoringService (tính điểm), KpiCriteriaMapper (hiển thị) và
 * KpiCriteriaService (validate bắt buộc gán lĩnh vực) để cả ba nhất quán.
 */
public final class BscPerspectiveResolver {

    private BscPerspectiveResolver() {}

    /** Lĩnh vực hiệu lực (entity), null nếu không suy ra được. */
    public static BscPerspective effectivePerspective(KpiCriteria kpi) {
        if (kpi == null) return null;
        if (kpi.getPerspective() != null) return kpi.getPerspective();
        if (kpi.getKeyResult() != null
                && kpi.getKeyResult().getObjective() != null
                && kpi.getKeyResult().getObjective().getPerspective() != null) {
            return kpi.getKeyResult().getObjective().getPerspective();
        }
        return null;
    }

    public static UUID effectivePerspectiveId(KpiCriteria kpi) {
        BscPerspective p = effectivePerspective(kpi);
        return p != null ? p.getId() : null;
    }
}
