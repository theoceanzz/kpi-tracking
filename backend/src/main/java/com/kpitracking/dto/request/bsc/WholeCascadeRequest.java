package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscFixedPerspective;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Phân rã CẢ BỘ tiêu chí: mỗi đơn vị đích nhận MỘT dòng "Kết quả cấp trên" chỉ có trọng số, điểm
 * của dòng = kết quả tổng của thẻ nguồn trong cùng đợt. Không có đóng góp, không có loại liên kết.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WholeCascadeRequest {

    /** Tên dòng ở thẻ con. Bỏ trống ⇒ "Kết quả BSC {tên thẻ nguồn}". */
    @Size(max = 255)
    private String itemName;

    /** Lĩnh vực của dòng — các báo cáo theo lĩnh vực sẽ dồn phần này vào đây. */
    @NotNull
    private BscFixedPerspective fixedPerspective;

    /** Giao mới hoặc cập nhật trọng số. */
    @Valid
    private List<Target> targets;

    /** Thu hồi: xoá dòng "Kết quả cấp trên" khỏi thẻ của các đơn vị này. */
    private List<UUID> revokeOrgUnitIds;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Target {
        @NotNull
        private UUID orgUnitId;
        @NotNull
        private Double weightPercentage;
    }
}
