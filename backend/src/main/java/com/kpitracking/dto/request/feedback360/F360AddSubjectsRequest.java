package com.kpitracking.dto.request.feedback360;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Thêm người được đánh giá: theo danh sách người, hoặc cả một đơn vị (kèm đơn vị con). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360AddSubjectsRequest {
    private List<UUID> userIds;
    private UUID orgUnitId;
    private Boolean includeChildren;
}
