package com.kpitracking.service.kpi;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.enums.KpiCycleStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.KpiCycleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Chốt chặn DUY NHẤT của luật "kỳ đã khoá thì không ghi gì vào kỳ nữa" — mọi service có thao
 * tác ghi vào đợt/KPI/bài nộp/đánh giá đợt gọi qua đây, không tự đọc {@code cycle.getStatus()}.
 *
 * <p>Lý do phải qua đây thay vì đọc entity: {@link KpiCycleRepository#lockStatusForShare} đọc
 * lại trạng thái từ DB và giữ {@code FOR SHARE} tới hết transaction. Thủ tục khoá kỳ giữ
 * {@code FOR UPDATE} trên cùng hàng, nên:
 * <ul>
 *   <li>thao tác ghi lấy khoá trước → khoá kỳ phải chờ nó commit, và thấy dữ liệu của nó khi quét;</li>
 *   <li>khoá kỳ lấy khoá trước → thao tác ghi chờ, rồi đọc được LOCKED và bị từ chối.</li>
 * </ul>
 * Không có đường nào để một thao tác commit SAU lúc khoá mà vẫn lọt.
 *
 * <p>Chỉ gọi trong transaction ghi: PostgreSQL không cho {@code FOR SHARE} trong transaction chỉ đọc.
 */
@Component
@RequiredArgsConstructor
public class CycleStatusGuard {

    private final KpiCycleRepository kpiCycleRepository;

    /** Ném lỗi nếu đợt thuộc một kỳ đã khoá. Đợt không thuộc kỳ nào thì luôn ghi được. */
    public void assertWritable(KpiPeriod period) {
        if (period == null) return;
        assertWritable(period.getKpiCycle());
        if (period.getStatus() != null && period.getStatus().isTerminal()) {
            throw new BusinessException(ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED, period.getName());
        }
    }

    /** Ném lỗi nếu kỳ đã khoá. */
    public void assertWritable(KpiCycle cycle) {
        if (cycle == null) return;
        if (isLocked(cycle.getId())) {
            throw lockedError(cycle.getName());
        }
    }

    /** Ném lỗi nếu KPI nằm trong kỳ đã khoá, hoặc đã bị chốt do khoá kỳ. */
    public void assertWritable(KpiCriteria kpi) {
        if (kpi == null) return;
        assertWritable(kpi.getKpiPeriod());
        if (kpi.getStatus() == KpiStatus.CLOSED_BY_LOCK) {
            throw new BusinessException(ErrorCode.KPI_CLOSED_CYCLE_LOCK, kpi.getName());
        }
    }

    /**
     * Kiểm tra CÓ khoá hàng (FOR SHARE). Trả true nếu kỳ đã khoá. Kỳ không tồn tại/đã xoá coi như
     * không khoá — việc kiểm tra tồn tại là của nơi gọi.
     */
    public boolean isLocked(UUID cycleId) {
        if (cycleId == null) return false;
        String status = kpiCycleRepository.lockStatusForShare(cycleId);
        return KpiCycleStatus.LOCKED.name().equals(status);
    }

    public static BusinessException lockedError(String cycleName) {
        return new BusinessException(ErrorCode.CYCLE_LOCKED, String.valueOf(cycleName));
    }
}
