package com.kpitracking.service.kpi;

import com.kpitracking.entity.CycleUnitEvaluation;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.repository.CycleUnitEvaluationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * "Kỳ này đã chốt ở đơn vị nào, và ai đang bị khoá vì thế" — nguồn chân lý DUY NHẤT của
 * luật khoá theo kỳ.
 *
 * Tách khỏi {@code KpiCycleEvaluationService} vì luật này giờ có hai nơi cần: chấm điểm kỳ
 * và chấm hạnh kiểm. Để nguyên chỗ cũ thì {@code ConductService} phải phụ thuộc ngược lại
 * {@code KpiCycleEvaluationService} — vốn đã phụ thuộc {@code ConductService} để lấy điểm
 * hạnh kiểm cho ma trận — thành vòng bean. Ở đây chỉ đụng repository nên không ai vòng lại.
 */
@Component
@RequiredArgsConstructor
public class CycleLockChecker {

    private final CycleUnitEvaluationRepository cycleUnitEvaluationRepository;

    /** Các đơn vị đã CHỐT trong kỳ. */
    public List<CycleUnitEvaluation> finalizedUnits(UUID cycleId) {
        return cycleUnitEvaluationRepository.findByKpiCycleId(cycleId).stream()
                .filter(e -> e.getStatus() == CycleUnitEvalStatus.FINALIZED)
                .toList();
    }

    /**
     * Đơn vị đã chốt đang khoá nhân viên thuộc {@code userUnit} (null nếu không bị khoá).
     * Khoá kế thừa xuống dưới: OrgUnit dùng materialized path nên đơn vị con
     * có path bắt đầu bằng path của cha — chốt ở cha thì con cũng bị khoá.
     */
    public OrgUnit lockingUnit(OrgUnit userUnit, List<CycleUnitEvaluation> finalizedUnits) {
        if (userUnit == null || userUnit.getPath() == null) return null;
        for (CycleUnitEvaluation e : finalizedUnits) {
            OrgUnit unit = e.getOrgUnit();
            if (unit != null && unit.getPath() != null && userUnit.getPath().startsWith(unit.getPath())) {
                return unit;
            }
        }
        return null;
    }

    /**
     * Như {@link #lockingUnit} nhưng BỎ QUA chính đơn vị đó — chỉ trả về đơn vị
     * cấp trên đang khoá. Dùng khi cần biết "có phải mở khoá từ trên xuống không".
     */
    public OrgUnit lockingAncestor(OrgUnit unit, List<CycleUnitEvaluation> finalizedUnits) {
        if (unit == null || unit.getPath() == null) return null;
        for (CycleUnitEvaluation e : finalizedUnits) {
            OrgUnit other = e.getOrgUnit();
            if (other == null || other.getPath() == null) continue;
            if (other.getId().equals(unit.getId())) continue;
            if (unit.getPath().startsWith(other.getPath())) return other;
        }
        return null;
    }

    /** Gộp hai bước hay đi cùng nhau: nạp danh sách đã chốt rồi tra khoá cho một nhân sự. */
    public OrgUnit lockingUnitForUser(UUID cycleId, OrgUnit userUnit) {
        if (cycleId == null || userUnit == null) return null;
        return lockingUnit(userUnit, finalizedUnits(cycleId));
    }
}
