package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PerspectiveScoreResponse {
    private UUID perspectiveId;
    private String code;
    private String name;
    private String color;
    /** Lĩnh vực cố định của hạng mục — dùng để gộp các hạng mục vào 4 ô lĩnh vực trên dashboard. */
    private String fixedPerspective;
    private String fixedPerspectiveName;
    private String fixedPerspectiveColor;
    private Double weightPercentage;
    private Integer kpiCount;
    /** Điểm đạt trung bình có trọng số của lĩnh vực (0..100+), null nếu không có KPI. */
    private Double achievementPercent;
    /** Đóng góp = weightPercentage% × achievementPercent. */
    private Double weightedScore;
}
