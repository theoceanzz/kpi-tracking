package com.kpitracking.dto.request.kpi;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Chia một dòng chỉ tiêu BSC thành KPI theo từng đợt — "KPI = BSC" ở tầng đơn vị.
 *
 * <p>VD hạng mục "Doanh thu 100 triệu" của một kỳ gồm 2 đợt: trưởng đơn vị gửi 2 dòng
 * {@code allocations} (đợt 1: 60 triệu / 60%, đợt 2: 40 triệu / 40%) và hệ thống tạo 2 KPI đã gắn
 * sẵn vào đúng dòng chỉ tiêu đó, nên chúng tự cộng ngược vào kết quả BSC của đơn vị.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateKpiFromBscRequest {

    @NotNull(message = "Vui lòng chọn chỉ tiêu BSC cần chia")
    private UUID scorecardPerspectiveId;

    /** Đơn vị nhận KPI; bỏ trống ⇒ các phòng ban của bộ tiêu chí. */
    private List<UUID> orgUnitIds;

    /** Người thực hiện; bỏ trống ⇒ KPI của đơn vị, giao cho người cụ thể sau. */
    private List<UUID> assignedToIds;

    /**
     * Giao cho TOÀN BỘ nhân sự của đơn vị nhận KPI, thay vì liệt kê từng người.
     *
     * <p>Phải giải ở server chứ không để client gửi sẵn danh sách id: mỗi đơn vị nhận một bản KPI
     * riêng nên danh sách người phải tính THEO TỪNG đơn vị — gửi một danh sách gộp sẽ gán nhân sự
     * của đơn vị này vào KPI của đơn vị kia. Bỏ qua nếu {@link #assignedToIds} có người.
     */
    private Boolean assignToAllUnitMembers;

    private String description;

    /** Bỏ trống ⇒ đơn vị tính của dòng chỉ tiêu BSC. */
    private String unit;

    private Boolean isReverseKpi;

    @NotEmpty(message = "Vui lòng chia chỉ tiêu cho ít nhất một đợt")
    @Valid
    private List<BscKpiAllocationRequest> allocations;
}
