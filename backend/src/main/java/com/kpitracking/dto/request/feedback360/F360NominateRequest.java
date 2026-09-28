package com.kpitracking.dto.request.feedback360;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Người được đánh giá đề cử thêm người chấm. Danh sách gửi lên THAY THẾ các đề cử trước đó. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360NominateRequest {
    private List<UUID> raterIds;
}
