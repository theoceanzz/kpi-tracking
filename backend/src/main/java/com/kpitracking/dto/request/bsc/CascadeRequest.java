package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscLinkType;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Phân rã MỘT chỉ tiêu của bộ tiêu chí cha xuống nhiều đơn vị cùng lúc
 * (docs/bsc-cascade-design.md — mục 4.2).
 *
 * <p>Mỗi đơn vị đích nhận một dòng {@code origin = ASSIGNED, locked = true}: trưởng đơn vị
 * không sửa được mục tiêu/trọng số của dòng đó, chỉ gắn KPI con và cập nhật kết quả.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadeRequest {

    /** Dòng chỉ tiêu của bộ tiêu chí cha đang được phân rã. */
    @NotNull
    private UUID scorecardPerspectiveId;

    /** Quan hệ với chỉ tiêu cha. Mặc định SUM (cộng dồn) nếu bỏ trống. */
    private BscLinkType linkType;

    @NotNull
    private List<CascadeTargetRequest> targets;
}
