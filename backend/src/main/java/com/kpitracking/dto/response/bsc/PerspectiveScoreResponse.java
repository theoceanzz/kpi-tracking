package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PerspectiveScoreResponse {
    private UUID perspectiveId;
    private String code;
    private String name;
    private String color;
    private Double weightPercentage;
    private Integer kpiCount;
    /** Điểm đạt trung bình có trọng số của viễn cảnh (0..100+), null nếu không có KPI. */
    private Double achievementPercent;
    /** Đóng góp = weightPercentage% × achievementPercent. */
    private Double weightedScore;
}
