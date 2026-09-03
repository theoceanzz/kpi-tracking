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
    /**
     * TRUE = hạng mục tự chấm theo mục tiêu của chính nó (kiểu OKR: tổng thực đạt / mục tiêu hạng mục);
     * FALSE = trung bình có trọng số tỉ lệ đạt của các KPI con (cách mặc định).
     */
    private Boolean scoredByTarget;
    /** Mục tiêu mong muốn của hạng mục — chỉ có nghĩa khi {@code scoredByTarget}. */
    private Double targetValue;
    /** Kết quả tối thiểu của hạng mục — dưới ngưỡng này thì điểm hạng mục = 0. */
    private Double minimumValue;
    /** Đơn vị tính của mục tiêu/thực đạt (VD: VNĐ, %, buổi). */
    private String unit;
    /** Tổng thực đạt của các KPI định lượng trong hạng mục — null khi không chấm theo mục tiêu. */
    private Double actualValue;
}
