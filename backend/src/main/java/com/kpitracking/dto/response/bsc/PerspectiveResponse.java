package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscPerspectiveStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PerspectiveResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    /** Mục tiêu mong muốn của hạng mục (null = chưa đặt). */
    private Double targetValue;
    /** Kết quả tối thiểu của hạng mục (null = chưa đặt). */
    private Double minimumValue;
    /** Đơn vị tính của mục tiêu/tối thiểu. */
    private String unit;
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
    /**
     * Bộ tiêu chí CHỦ của hạng mục ({@code BscPerspectiveOwnership}): chỉ sửa được hạng mục từ bộ này.
     * null = chưa bộ nào tự thêm, sửa được từ bất kỳ bộ nào.
     */
    private UUID ownerScorecardId;
    private String ownerScorecardName;
    /** Mọi bộ tiêu chí còn sống đang có dòng của hạng mục — khác rỗng thì không xoá được. */
    private List<UUID> usedInScorecardIds;
}
