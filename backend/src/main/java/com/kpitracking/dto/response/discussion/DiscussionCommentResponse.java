package com.kpitracking.dto.response.discussion;

import com.kpitracking.enums.DiscussionCommentKind;
import com.kpitracking.enums.DiscussionReactionType;
import com.kpitracking.enums.DiscussionTargetType;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Một bình luận / dòng hệ thống trong khung thảo luận. Bình luận đã xoá chỉ còn khung (body, tệp... rỗng). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionCommentResponse {

    private UUID id;
    private DiscussionTargetType targetType;
    private UUID targetId;
    private UUID parentId;
    private DiscussionCommentKind kind;
    private String body;
    /** Chữ của dòng hệ thống, đã dịch theo ngôn ngữ người xem. */
    private String systemText;
    private Map<String, Object> systemMeta;
    private Author author;
    private Instant createdAt;
    private Instant editedAt;
    private boolean deleted;
    private int replyCount;
    /** Trả lời mới nhất (tăng dần theo thời gian) — chỉ có ở bình luận gốc. */
    private List<DiscussionCommentResponse> replies;
    private List<Attachment> attachments;
    private List<Reaction> reactions;
    private List<Mention> mentions;
    private boolean canEdit;
    private boolean canDelete;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Author {
        private UUID id;
        private String fullName;
        private String avatarUrl;
        /** Chức danh (tên vai trò chính). */
        private String title;
        private String unitName;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Attachment {
        private UUID id;
        private String fileName;
        private String fileUrl;
        private Long fileSize;
        private String contentType;
        private boolean image;
        /** Sao từ thư viện tài liệu (nhãn "Từ thư viện: …"). */
        private boolean fromLibrary;
        private String sourceDocumentTitle;
        /** Chỉ có khi tài liệu gốc còn và người xem mở được nó — link "Mở bản mới nhất". */
        private UUID sourceDocumentId;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Reaction {
        private DiscussionReactionType type;
        private int count;
        private boolean mine;
        /** Tên vài người đã thả (tooltip). */
        private List<String> userNames;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Mention {
        private UUID id;
        private String fullName;
    }
}
