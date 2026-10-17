package com.kpitracking.dto.request.task;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

/**
 * Một cặp (việc, người theo dõi) mà người dùng đã đồng ý gỡ khi đổi KPI — lấy từ kết quả xem trước
 * ({@code assign-impact} / {@code move-impact}). So theo cặp chứ không theo người: cùng một người theo dõi thêm một việc
 * con khác giữa chừng vẫn là lần gỡ mới, phải xác nhận lại.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode
public class FollowerRemovalRef {

    @NotNull
    private UUID taskId;
    @NotNull
    private UUID userId;
}
