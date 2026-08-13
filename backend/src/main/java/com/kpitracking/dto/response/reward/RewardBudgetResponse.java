package com.kpitracking.dto.response.reward;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class RewardBudgetResponse {

    private UUID id;
    private UUID grantorUserId;
    private String grantorName;
    private String grantorEmail;

    private UUID kpiCycleId;
    private String kpiCycleName;

    private UUID kpiPeriodId;
    private String kpiPeriodName;

    private LocalDate periodStart;
    private LocalDate periodEnd;

    private Integer allocatedPoints;

    /**
     * SUY RA từ tổng các đề nghị đang chờ duyệt và đã duyệt — không đọc từ cột đếm.
     * Nhờ vậy từ chối/huỷ/thu hồi tự trả lại hạn mức mà không cần logic hoàn trả.
     */
    private Integer usedPoints;

    private Integer remainingPoints;

    private Integer maxPerAward;

    private String note;

    /**
     * Bật khi khoảng ngày của ngân sách đã lệch so với kỳ được gắn — xảy ra khi ai đó
     * sửa ngày của kỳ sau lúc cấp hạn mức. Giao diện hiện cảnh báo kèm nút đồng bộ lại;
     * hệ thống cố ý KHÔNG tự dịch chuyển, vì hạn mức đã cấp là một cam kết.
     */
    private Boolean cycleDatesOutOfSync;
}
