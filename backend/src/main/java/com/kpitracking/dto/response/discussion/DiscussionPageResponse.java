package com.kpitracking.dto.response.discussion;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Một trang bình luận gốc, MỚI NHẤT TRƯỚC (client đảo lại để hiện cũ ở trên, mới ở dưới).
 * {@code nextCursor} lấy trang CŨ hơn; null = đã hết.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionPageResponse {

    private List<DiscussionCommentResponse> content;
    private String nextCursor;
    private boolean hasMore;
    private boolean canComment;
    private boolean canModerate;
    /** Tiêu đề đối tượng (tên KPI / công việc) và KPI liên quan — để dựng link. */
    private String targetTitle;
    private UUID kpiId;
}
