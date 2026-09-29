package com.kpitracking.dto.request.feedback360;

import com.kpitracking.enums.F360Relationship;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Người duyệt chỉnh danh sách người chấm đề xuất rồi (tuỳ chọn) duyệt. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360ApprovalRequest {
    private List<Addition> add;
    /** Id phiếu cần gỡ. */
    private List<UUID> remove;
    private Boolean approve;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Addition {
        private UUID raterId;
        private F360Relationship relationship;
    }
}
