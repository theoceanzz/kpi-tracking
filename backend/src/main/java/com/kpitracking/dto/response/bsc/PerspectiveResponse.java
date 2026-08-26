package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscPerspectiveStatus;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PerspectiveResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private String color;
    private String icon;
    private Integer displayOrder;
    private BscPerspectiveStatus status;
    /** Lĩnh vực cố định mà hạng mục thuộc về. */
    private BscFixedPerspective fixedPerspective;
    /** Tên hiển thị của lĩnh vực cố định (VD "Tài chính") — tiện cho FE gộp nhóm. */
    private String fixedPerspectiveName;
    /** Màu của lĩnh vực cố định. */
    private String fixedPerspectiveColor;
}
