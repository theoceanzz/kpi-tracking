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
    private Double weightPercentage;
    private Integer displayOrder;
    /** Lĩnh vực cố định của hạng mục — dùng để gộp nhóm khi hiển thị/sửa bộ tiêu chí. */
    private String fixedPerspective;
    private String fixedPerspectiveName;
    private String fixedPerspectiveColor;
}
