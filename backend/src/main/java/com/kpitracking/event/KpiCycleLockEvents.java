package com.kpitracking.event;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sự kiện của khoá kỳ. Chỉ mang id: listener chạy SAU commit trong transaction riêng và tự nạp
 * lại dữ liệu, không giữ entity của transaction đã đóng.
 */
public final class KpiCycleLockEvents {

    private KpiCycleLockEvents() {}

    /**
     * Kỳ vừa khoá.
     *
     * @param hadUnfinished       kỳ có đợt dở lúc khoá (Phương án 2) — false thì chỉ báo quản lý
     * @param movedKpiTargetCycle KPI bị chuyển kỳ → kỳ đích
     * @param closedKpiIds        KPI bị chốt CLOSED_BY_LOCK
     */
    public record CycleLockedEvent(UUID cycleId, UUID actorId, boolean hadUnfinished,
                                   Map<UUID, UUID> movedKpiTargetCycle, List<UUID> closedKpiIds) {}
}
