package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscGateEffect;
import com.kpitracking.enums.BscGateScope;
import com.kpitracking.enums.BscItemOrigin;
import com.kpitracking.enums.BscLinkType;
import com.kpitracking.enums.BscMeasurementSource;
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

    // ── Cascade & quyền biên tập (QĐ-3) ───────────────

    /** ASSIGNED = cấp trên giao (khoá), SELF = đơn vị tự thêm. */
    private BscItemOrigin origin;
    private Boolean locked;
    private UUID parentItemId;
    /** Tên chỉ tiêu cha — để tooltip trỏ ngược lên BSC công ty mà không phải gọi thêm API. */
    private String parentItemName;
    private String parentScorecardName;
    private BscLinkType linkType;
    private Double contributionValue;
    private Double contributionPercent;

    // ── Nguồn số liệu & hạng mục chặn ─────────────────

    private BscMeasurementSource measurementSource;
    private Boolean isGate;
    private Double gateMinPercent;
    private BscGateEffect gateEffect;
    private Integer gateCapRating;
    private BscGateScope gateAppliesTo;
    /** Lĩnh vực cố định của hạng mục — dùng để gộp nhóm khi hiển thị/sửa bộ tiêu chí. */
    private String fixedPerspective;
    private String fixedPerspectiveName;
    private String fixedPerspectiveColor;
}
