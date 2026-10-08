package com.kpitracking.mapper;

import com.kpitracking.dto.response.discussion.DiscussionCommentResponse;
import com.kpitracking.entity.DiscussionAttachment;
import com.kpitracking.entity.DiscussionComment;
import com.kpitracking.service.discussion.CollabAttachmentPolicy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Phần ánh xạ thuần của bình luận. Tác giả, trả lời, cảm xúc, nhắc tên, chữ dòng hệ thống và các cờ quyền do
 * {@code DiscussionService} ghép thêm (cần dữ liệu ngoài bản ghi).
 */
@Mapper(componentModel = "spring", imports = CollabAttachmentPolicy.class)
public interface DiscussionMapper {

    @Mapping(target = "author", ignore = true)
    @Mapping(target = "systemText", ignore = true)
    @Mapping(target = "deleted", expression = "java(comment.isDeleted())")
    @Mapping(target = "replies", ignore = true)
    @Mapping(target = "attachments", ignore = true)
    @Mapping(target = "reactions", ignore = true)
    @Mapping(target = "mentions", ignore = true)
    @Mapping(target = "canEdit", ignore = true)
    @Mapping(target = "canDelete", ignore = true)
    DiscussionCommentResponse toResponse(DiscussionComment comment);

    @Mapping(target = "image", expression = "java(CollabAttachmentPolicy.isImage(attachment.getContentType()))")
    @Mapping(target = "fromLibrary", expression = "java(attachment.getSourceDocumentId() != null)")
    @Mapping(target = "sourceDocumentId", ignore = true)
    DiscussionCommentResponse.Attachment toAttachment(DiscussionAttachment attachment);
}
