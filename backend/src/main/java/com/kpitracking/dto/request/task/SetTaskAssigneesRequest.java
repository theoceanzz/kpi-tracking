package com.kpitracking.dto.request.task;

import com.kpitracking.enums.TaskCompletionMode;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Thay danh sách người thực hiện. Người đầu tiên (hoặc {@code primaryId}) là người phụ trách chính. Việc gắn KPI: mọi
 * người phải là người tạo / thực hiện của KPI và mình được giao cho họ; việc không KPI: bất kỳ ai cùng tổ chức.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SetTaskAssigneesRequest {

    @NotNull
    private List<UUID> assigneeIds;
    private UUID primaryId;
    private TaskCompletionMode completionMode;
    @NotNull
    private Long version;
}
