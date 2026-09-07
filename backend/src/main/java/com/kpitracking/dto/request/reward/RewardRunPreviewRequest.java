package com.kpitracking.dto.request.reward;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Yêu cầu tính bảng xếp hạng cho một đợt/kỳ cụ thể. */
@Data
public class RewardRunPreviewRequest {

    /** Id của kỳ hoặc đợt, tuỳ phạm vi của chương trình. */
    @NotNull(message = "Vui lòng chọn kỳ hoặc đợt để xếp hạng")
    private UUID targetId;

    /**
     * Bậc thưởng riêng cho lần chạy này. Để trống thì dùng bậc mặc định của chương trình.
     *
     * <p>Cho phép sửa ở đây thay vì bắt sửa cấu hình chương trình: thưởng cuối năm có thể
     * hậu hĩnh hơn các quý mà không làm sai lịch sử các lần phát trước — mỗi lần chạy
     * chụp lại bậc thực sự dùng.
     */
    @Valid
    private List<RewardProgramRequest.Tier> tiers;
}
