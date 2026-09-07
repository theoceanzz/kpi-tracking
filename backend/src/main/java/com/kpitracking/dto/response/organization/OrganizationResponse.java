package com.kpitracking.dto.response.organization;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationResponse {

    private UUID id;
    private String name;
    private String code;
    private String status;
    private List<HierarchyLevelResponse> hierarchyLevels;
    private Double evaluationMaxScore;
    private java.util.List<EvaluationLevelResponse> evaluationLevels;
    private java.util.List<QualitativeLevelResponse> qualitativeLevels;
    private String performanceMatrix;
    private String unitClassificationRules;
    private Integer kpiReminderPercentage;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
    private Boolean enableAi;
    private Boolean enableQualitative;
    private Boolean enableBsc;
    /** Chấm hạnh kiểm theo bộ tiêu chí có trọng số. */
    private Boolean enableConduct;
    private Boolean enableReward;
    private Boolean enableCashWallet;
    /** Số đồng đổi được 1 điểm. Giao diện dùng để hiện quy đổi mà không phải gọi thêm API cấu hình. */
    private Long pointExchangeRate;
    private Instant createdAt;
    private Instant updatedAt;

    // ===== Hồ sơ doanh nghiệp =====
    private String logoUrl;
    private String coverUrl;
    private String industry;
    private String taxCode;
    private Integer employeeCount;
    private String description;
}
