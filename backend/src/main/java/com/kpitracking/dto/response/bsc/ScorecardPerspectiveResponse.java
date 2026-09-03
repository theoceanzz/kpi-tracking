package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPerspectiveResponse {
    private UUID id;
    private UUID perspectiveId;
    private String code;
    private String name;
    private String color;
    /** Mục tiêu mong muốn của hạng mục (null = chưa đặt). */
    private Double targetValue;
    /** Kết quả tối thiểu của hạng mục (null = chưa đặt). */
    private Double minimumValue;
    /** Đơn vị tính của mục tiêu/tối thiểu. */
    private String unit;
    private Double weightPercentage;
    private Integer displayOrder;
    /** Lĩnh vực cố định của hạng mục — dùng để gộp nhóm khi hiển thị/sửa bộ tiêu chí. */
    private String fixedPerspective;
    private String fixedPerspectiveName;
    private String fixedPerspectiveColor;
}
