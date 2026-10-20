package com.kpitracking.dto.request.reward;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Đánh dấu đã ăn mừng các lượt (id lấy từ {@code refId} của danh sách celebrations). */
@Data
public class RewardCelebrationAckRequest {

    @NotEmpty(message = "{validation.celebrationRefIdsRequired}")
    @Size(max = 200, message = "{validation.celebrationRefIdsTooMany}")
    private List<UUID> refIds;
}
