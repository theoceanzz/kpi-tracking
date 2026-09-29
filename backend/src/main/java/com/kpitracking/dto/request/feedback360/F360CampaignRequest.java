package com.kpitracking.dto.request.feedback360;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Tạo hoặc sửa chiến dịch 360. Trường để trống khi SỬA = giữ nguyên. Ở trạng thái OPEN chỉ
 * sửa được tên, mô tả và hạn — mọi thứ còn lại đã quyết định phiếu người ta đang điền.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360CampaignRequest {

    @NotBlank(message = "{validation.campaignNameCannotEmpty}")
    private String name;

    private String description;

    /** Kỳ KPI gắn với chiến dịch (tuỳ chọn). */
    private UUID kpiCycleId;

    /** Bộ câu hỏi; bỏ trống khi tạo = bộ mặc định của tổ chức. */
    private UUID templateId;

    /** Ngày mở dự kiến (tự khởi động). Có kỳ thì phải nằm trong khung của kỳ — xem F360Schedule. */
    private Instant startAt;

    private Instant dueAt;

    @Min(value = 2, message = "{validation.anonymityThresholdMustLeast2}")
    @Max(value = 10, message = "{validation.anonymityThresholdCanMost10}")
    private Integer anonymityThreshold;

    private Boolean includeSelf;
    private Boolean managerAnonymous;
    private Boolean releaseToSubject;
    private Boolean autoClose;

    /** Trọng số theo nhóm quan hệ, khoá là tên enum F360Relationship. */
    private Map<String, Double> relationshipWeights;

    @Min(value = 0, message = "{validation.numberPeersCannotNegative}")
    @Max(value = 20, message = "{validation.numberPeersCanMost20}")
    private Integer maxPeers;

    @Min(value = 0, message = "{validation.numberDirectReportsCannotNegative}")
    @Max(value = 30, message = "{validation.numberDirectReportsCanMost30}")
    private Integer maxDirectReports;

    /** Mở giai đoạn đề cử trước khi chấm (người được đánh giá đề cử thêm, quản lý duyệt). */
    private Boolean allowNomination;
    private Instant nominationDeadline;

    @Min(value = 0, message = "{validation.numberNomineesCannotNegative}")
    @Max(value = 20, message = "{validation.most20Nominees}")
    private Integer maxNominees;

    /** Tách liên kết người chấm ↔ câu trả lời khi đóng chiến dịch (§6.3). */
    private Boolean strictAnonymity;

    /** Điểm 360 có vào xếp loại kỳ không — chỉ khác DEVELOPMENT_ONLY khi tổ chức cho phép. */
    private com.kpitracking.enums.F360ScoringMode scoringMode;

    @Min(value = 0, message = "{validation.conductRatioMustBetween0100}")
    @Max(value = 100, message = "{validation.conductRatioMustBetween0100}")
    private Integer blendConductPercent;

    /**
     * Năng lực + câu hỏi soạn thẳng trong form chiến dịch. Có mặt ⇒ thành bộ câu hỏi RIÊNG của chiến
     * dịch (tạo mới hoặc thay nội dung); bỏ trống ⇒ giữ bộ hiện có / dùng bộ mặc định.
     */
    @jakarta.validation.Valid
    private F360TemplateRequest questions;

    /** Tóm tắt nhận xét bằng AI khi đóng chiến dịch. */
    private Boolean aiSummary;

    @Min(value = 1, message = "{validation.eachRaterMustAssignedLeast1Form}")
    @Max(value = 50, message = "{validation.eachRaterCanMost50Forms}")
    private Integer maxAssignmentsPerRater;
}
