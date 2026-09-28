package com.kpitracking.dto.response.kpi.lock;

import com.kpitracking.enums.KpiCycleStatus;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiPeriodStatus;
import com.kpitracking.enums.KpiProgressBucket;
import com.kpitracking.enums.PeriodProgress;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Hộp thoại khoá kết quả ở đơn vị gốc: phân loại từng đợt và mọi thứ UI cần để xử lý đợt dở. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleLockPreviewResponse {
    private UUID cycleId;
    private String cycleName;
    private KpiFrequency cycleType;
    private KpiCycleStatus status;
    private Instant startDate;
    private Instant endDate;

    /** Gửi lại khi khoá — dữ liệu đổi giữa chừng thì server từ chối. */
    private String previewToken;

    private int totalPeriods;
    private int completedCount;
    private int inProgressCount;
    private int notStartedCount;

    /** Kỳ đích hợp lệ để chuyển đợt (cùng tổ chức, cùng loại, đang mở). Rỗng ⇒ chỉ chốt/huỷ. */
    private List<CycleRef> targetCycles;

    private List<PeriodPreview> periods;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CycleRef {
        private UUID id;
        private String name;
        private Instant startDate;
        private Instant endDate;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PeriodPreview {
        private UUID periodId;
        private String name;
        private Instant startDate;
        private Instant endDate;
        private KpiPeriodStatus status;
        private PeriodProgress progress;
        private int kpiCount;
        /** Số KPI theo từng nhóm tiến độ (chỉ nhóm có KPI). */
        private Map<KpiProgressBucket, Long> bucketCounts;
        /** Số KPI chưa ở trạng thái cuối — sẽ bị chuyển hoặc chốt. */
        private int unfinishedKpiCount;
        /** Có KPI đã hoàn thành ⇒ chuyển kỳ sẽ TÁCH đợt thay vì chuyển nguyên. */
        private boolean willSplitOnTransfer;
        /** Huỷ chỉ khi chưa bắt đầu. */
        private boolean canCancel;
    }
}
