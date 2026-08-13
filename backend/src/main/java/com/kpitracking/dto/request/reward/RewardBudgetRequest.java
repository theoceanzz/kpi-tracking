package com.kpitracking.dto.request.reward;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Cấp hạn mức điểm cho một người được phép trao thưởng.
 *
 * <p>Có ba cách khoanh thời gian, chọn MỘT:
 * <ul>
 *   <li>Truyền {@link #kpiCycleId} — service tự copy ngày bắt đầu/kết thúc của kỳ xuống.</li>
 *   <li>Truyền {@link #kpiPeriodId} — tương tự nhưng theo đợt.</li>
 *   <li>Truyền {@link #periodStart} và {@link #periodEnd} trực tiếp.</li>
 * </ul>
 * Dù chọn cách nào thì khoảng ngày vẫn là thứ có thẩm quyền duy nhất, và một người
 * không được có hai ngân sách chồng lấn ngày (ràng buộc ở tầng DB).
 */
@Data
public class RewardBudgetRequest {

    @NotNull(message = "Vui lòng chọn người được cấp hạn mức")
    private UUID grantorUserId;

    /** Nếu có, ngày hiệu lực lấy theo kỳ này. Không được truyền cùng {@link #kpiPeriodId}. */
    private UUID kpiCycleId;

    /** Nếu có, ngày hiệu lực lấy theo đợt này. Không được truyền cùng {@link #kpiCycleId}. */
    private UUID kpiPeriodId;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    @NotNull(message = "Vui lòng nhập số điểm được cấp")
    @Min(value = 0, message = "Số điểm được cấp không được âm")
    private Integer allocatedPoints;

    /** Trần cho mỗi người nhận trong một lần thưởng. Để trống = không giới hạn. */
    @Min(value = 1, message = "Mức tối đa mỗi lần thưởng phải lớn hơn 0")
    private Integer maxPerAward;

    private String note;
}
