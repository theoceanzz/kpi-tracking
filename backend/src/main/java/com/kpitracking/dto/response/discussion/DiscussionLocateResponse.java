package com.kpitracking.dto.response.discussion;

import com.kpitracking.enums.DiscussionTargetType;
import lombok.*;

import java.util.UUID;

/** Bình luận nằm ở đâu — để link trong thông báo mở đúng KPI / công việc rồi cuộn tới bình luận. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionLocateResponse {

    private UUID commentId;
    private UUID rootId;
    private DiscussionTargetType targetType;
    private UUID targetId;
    private UUID kpiId;
}
