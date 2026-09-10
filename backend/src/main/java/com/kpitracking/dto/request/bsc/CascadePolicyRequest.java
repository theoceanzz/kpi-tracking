package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscLinkedWeightEnforce;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Chính sách điểm BSC: trần điểm công nhận và ràng buộc KPI phải liên kết BSC (QĐ-8).
 *
 * <p>Các trường hệ số (chế độ, sàn/trần hệ số, bảng dải) đã bị gỡ khỏi API cùng lúc với việc bỏ
 * hệ số phòng/công ty — cột trong DB vẫn còn để đọc dữ liệu cũ, nhưng không nhận từ ngoài vào nữa.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadePolicyRequest {

    @NotBlank
    private String name;

    /**
     * Phạm vi áp dụng — chọn MỘT trong ba: gắn kỳ, gắn đợt, hoặc để trống cả hai làm bản mặc định
     * của tổ chức. Gửi cả kỳ lẫn đợt sẽ bị từ chối vì lúc chấm không biết theo bản nào.
     */
    private UUID kpiCycleId;

    /** Các đợt áp dụng riêng. Gửi lên là thay thế trọn bộ danh sách đợt của chính sách. */
    private List<UUID> kpiPeriodIds;

    /** Trần điểm gốc: điểm công nhận = MIN(điểm gốc, trần này). */
    private Double recognizedCapPercent;

    private Double minBscLinkedWeight;
    private BscLinkedWeightEnforce linkedWeightEnforce;
}
