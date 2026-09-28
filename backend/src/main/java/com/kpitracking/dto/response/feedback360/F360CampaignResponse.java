package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360ScoringMode;
import lombok.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Chiến dịch 360 kèm con số tiến độ tổng (chỉ là số đếm, không có danh tính người chấm). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360CampaignResponse {
    private UUID id;
    private String name;
    private String description;
    private F360CampaignStatus status;
    private F360ScoringMode scoringMode;
    private UUID kpiCycleId;
    private String kpiCycleName;
    private UUID templateId;
    private String templateName;
    private Integer scaleMax;
    private Integer anonymityThreshold;
    private Boolean strictAnonymity;
    private Boolean includeSelf;
    private Boolean managerAnonymous;
    private Boolean releaseToSubject;
    private Boolean autoClose;
    private Map<String, Double> relationshipWeights;
    private Integer maxPeers;
    private Integer maxDirectReports;
    private Integer maxAssignmentsPerRater;
    private Integer maxNominees;
    private Boolean allowNomination;
    private Instant nominationDeadline;
    private Integer blendConductPercent;
    private Boolean aiSummary;
    private Instant unlinkedAt;
    /** Tổ chức có cho 360 vào xếp loại kỳ không — UI chỉ mở lựa chọn chế độ tính điểm khi true. */
    private Boolean orgAllowsRating;
    private Instant startAt;
    private Instant dueAt;
    private Instant launchedAt;
    private Instant closedAt;
    private Instant releasedAt;
    private Instant createdAt;
    private String createdByName;

    private Integer subjectCount;
    /** Phiếu còn hiệu lực (không tính phiếu đã gỡ). */
    private Integer assignmentCount;
    private Integer submittedCount;
    /** Người xem có quyền quản trị chiến dịch này không — UI dựa vào đây để hiện nút. */
    private Boolean canManage;

    /** Tên các năng lực được hỏi (theo thứ tự) — tóm tắt cho thẻ chiến dịch. */
    private java.util.List<String> competencyNames;
    /** Tổng số câu (chấm điểm + nhận xét mở). */
    private Integer questionCount;
}
