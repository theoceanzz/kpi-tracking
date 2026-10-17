package com.kpitracking.service;

import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.enums.BscScorecardApplyScope;
import com.kpitracking.enums.KpiCycleStatus;
import com.kpitracking.service.kpi.CycleStatusGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Luật khoá kỳ cho BSC: kỳ đã khoá thì không sửa bộ tiêu chí áp cho đợt của kỳ đó, không phân rã,
 * không đổi chế độ chấm, không tính lại / nhập tay / chốt / mở khoá kết quả đơn vị của đợt đó.
 *
 * <p>Chỉ chặn theo KỲ ({@link CycleStatusGuard#assertWritable(KpiCycle)}), không theo trạng thái
 * đợt: kết quả BSC được tính và chốt SAU khi đợt kết thúc, nên một đợt đã qua vẫn phải ghi được
 * chừng nào kỳ chưa khoá.
 *
 * <p>Gọi trong transaction ghi (khoá {@code FOR SHARE} như mọi chỗ khác dùng CycleStatusGuard).
 */
@Component
@RequiredArgsConstructor
public class BscCycleLockGuard {

    private final CycleStatusGuard cycleStatusGuard;

    /** Ném {@code CYCLE_LOCKED} nếu thẻ áp cho một đợt thuộc kỳ đã khoá. */
    public void assertWritable(BscScorecard scorecard) {
        for (KpiCycle cycle : cyclesOf(scorecard)) {
            cycleStatusGuard.assertWritable(cycle);
        }
    }

    /** Ném {@code CYCLE_LOCKED} nếu một trong các đợt thuộc kỳ đã khoá. */
    public void assertWritable(Collection<KpiPeriod> periods) {
        if (periods == null) return;
        Map<UUID, KpiCycle> cycles = new LinkedHashMap<>();
        for (KpiPeriod p : periods) {
            if (p != null && p.getKpiCycle() != null) cycles.putIfAbsent(p.getKpiCycle().getId(), p.getKpiCycle());
        }
        cycles.values().forEach(cycleStatusGuard::assertWritable);
    }

    /** Ném {@code CYCLE_LOCKED} nếu kỳ đã khoá. */
    public void assertWritable(KpiCycle cycle) {
        cycleStatusGuard.assertWritable(cycle);
    }

    /** Ném {@code CYCLE_LOCKED} nếu đợt thuộc kỳ đã khoá. */
    public void assertWritable(KpiPeriod period) {
        if (period != null) cycleStatusGuard.assertWritable(period.getKpiCycle());
    }

    /**
     * Tên kỳ đã khoá mà thẻ áp vào (null = không có). Chỉ đọc trạng thái trên entity, KHÔNG khoá
     * hàng — dùng cho câu trả lời "xoá được không" trong transaction chỉ đọc; thao tác ghi thật vẫn
     * phải qua {@link #assertWritable(BscScorecard)}.
     */
    public String lockedCycleName(BscScorecard scorecard) {
        return cyclesOf(scorecard).stream()
                .filter(c -> c.getStatus() == KpiCycleStatus.LOCKED)
                .map(KpiCycle::getName)
                .findFirst().orElse(null);
    }

    private Collection<KpiCycle> cyclesOf(BscScorecard s) {
        if (s == null) return List.of();
        if (s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null) {
            return List.of(s.getKpiCycle());
        }
        Map<UUID, KpiCycle> cycles = new LinkedHashMap<>();
        List<KpiPeriod> periods = s.getKpiPeriods() != null ? s.getKpiPeriods() : List.of();
        for (KpiPeriod p : periods) {
            if (p.getKpiCycle() != null) cycles.putIfAbsent(p.getKpiCycle().getId(), p.getKpiCycle());
        }
        return cycles.values();
    }
}
