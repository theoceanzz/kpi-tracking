package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RewardRunStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RewardProgramRunResponse {

    private UUID id;
    private UUID programId;
    private String programName;

    private UUID kpiPeriodId;
    private UUID kpiCycleId;
    /** Tên đợt hoặc kỳ, tuỳ cái nào có — để giao diện khỏi phải tra thêm. */
    private String targetName;

    private RewardRunStatus status;
    private Integer totalPoints;
    private Integer recipientCount;

    private UUID executedByUserId;
    private String executedByName;
    private Instant executedAt;
    private Instant revertedAt;

    private Instant createdAt;

    /** Bậc thưởng THỰC SỰ dùng cho lần chạy này — có thể khác bậc mặc định của chương trình. */
    private List<com.kpitracking.dto.request.reward.RewardProgramRequest.Tier> tiers;

    private List<Item> items;

    /**
     * Những người bị loại khỏi bảng xếp hạng, kèm lý do.
     *
     * <p>Không có danh sách này thì quản trị viên chỉ thấy ai đó "vắng mặt" và tưởng hệ
     * thống bỏ sót — trong khi lý do thật có thể là chưa được chấm điểm, hoặc điểm dưới
     * mức sàn của chương trình.
     */
    private List<Skipped> skipped;

    @Data
    @Builder
    public static class Item {
        private UUID userId;
        private String fullName;
        private String employeeCode;
        private String orgUnitName;
        /** Hạng thi đấu: người đồng điểm dùng chung số này. */
        private Integer rank;
        private Integer orderIndex;
        private Double metricValue;
        private Integer points;
    }

    @Data
    @Builder
    public static class Skipped {
        private UUID userId;
        private String fullName;
        private String reason;
    }
}
