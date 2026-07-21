package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCriteriaResponse {

    private UUID id;
    private KpiType kpiType;
    private String name;
    private String description;
    private Double weight;
    private Double targetValue;
    private String unit;
    private KpiFrequency frequency;
    private KpiStatus status;
    private UUID orgUnitId;
    private java.util.List<UUID> orgUnitIds;
    private String orgUnitName;
    private java.util.List<com.kpitracking.dto.response.user.UserResponse> assignees;
    private java.util.List<UUID> assigneeIds;
    private java.util.List<String> assigneeNames;
    private UUID createdById;
    private String createdByName;
    private UUID approvedById;
    private String approvedByName;
    private String rejectReason;
    private Instant submittedAt;
    private Instant approvedAt;
    private Double minimumValue;
    private Boolean isReverseKpi;
    private Boolean isBonusKpi;
    private Instant deadline;
    private Instant effectiveDeadline;
    private UUID kpiPeriodId;
    private KpiPeriodResponse kpiPeriod;
    private Integer submissionCount;
    private Integer expectedSubmissions;
    private UUID keyResultId;
    private String keyResultName;
    private String keyResultCode;
    private UUID objectiveId;
    private String objectiveName;
    private String objectiveCode;
    // Viễn cảnh gán TRỰC TIẾP trên KPI (dùng cho form sửa — chỉ phần gán trực tiếp).
    private UUID perspectiveId;
    private String perspectiveName;
    private String perspectiveColor;
    // Viễn cảnh HIỆU LỰC (gồm cả kế thừa từ Objective cha) — dùng để hiển thị tag.
    // Lưu ý: "perspective" ở đây thực chất là HẠNG MỤC (BscPerspective). Viễn cảnh cố định (4 nhóm) nằm ở các field *FixedPerspective* bên dưới.
    private UUID effectivePerspectiveId;
    private String effectivePerspectiveName;
    private String effectivePerspectiveColor;
    // Viễn cảnh CỐ ĐỊNH (1 trong 4) mà hạng mục hiệu lực của KPI thuộc về — dùng để gộp nhóm hiển thị.
    private String effectiveFixedPerspective;
    private String effectiveFixedPerspectiveName;
    private String effectiveFixedPerspectiveColor;
    private UUID parentId;
    private String parentName;
    private KpiParentRelationType parentRelationType;
    private Instant createdAt;
    private Instant updatedAt;
    private Boolean hasChildren;
    private java.util.List<String> delegatedToNames;
    private java.util.List<UUID> delegatedToIds;
    private Double childrenWeightTotal;
    private UUID replacedById;
    private String replacedByName;
    private String replacementReason;
}
