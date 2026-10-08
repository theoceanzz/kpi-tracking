package com.kpitracking.mapper;

import com.kpitracking.dto.response.task.KpiTaskEventResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.KpiTaskAttachment;
import com.kpitracking.entity.KpiTaskChecklistItem;
import com.kpitracking.entity.KpiTaskEvent;
import com.kpitracking.service.discussion.CollabAttachmentPolicy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Phần ánh xạ thuần của công việc. Thông tin KPI, số đếm, quá hạn và quyền do {@code KpiTaskService} ghép thêm.
 */
@Mapper(componentModel = "spring", imports = CollabAttachmentPolicy.class)
public interface KpiTaskMapper {

    @Mapping(target = "kpiId", source = "kpiCriteriaId")
    @Mapping(target = "ownerId", source = "owner.id")
    @Mapping(target = "ownerName", source = "owner.fullName")
    @Mapping(target = "ownerAvatarUrl", source = "owner.avatarUrl")
    @Mapping(target = "kpiName", ignore = true)
    @Mapping(target = "kpiStatus", ignore = true)
    @Mapping(target = "kpiDeleted", ignore = true)
    @Mapping(target = "kpiPeriodId", ignore = true)
    @Mapping(target = "kpiPeriodName", ignore = true)
    @Mapping(target = "overdue", ignore = true)
    @Mapping(target = "checklistDone", ignore = true)
    @Mapping(target = "checklistTotal", ignore = true)
    @Mapping(target = "attachmentCount", ignore = true)
    @Mapping(target = "commentCount", ignore = true)
    @Mapping(target = "unreadComments", ignore = true)
    @Mapping(target = "canEdit", ignore = true)
    @Mapping(target = "readOnlyReason", ignore = true)
    @Mapping(target = "checklist", ignore = true)
    @Mapping(target = "attachments", ignore = true)
    @Mapping(target = "createdById", source = "createdBy")
    @Mapping(target = "createdByName", ignore = true)
    @Mapping(target = "dueToday", ignore = true)
    @Mapping(target = "dueBucket", ignore = true)
    @Mapping(target = "parentTitle", ignore = true)
    @Mapping(target = "subtaskDone", ignore = true)
    @Mapping(target = "subtaskTotal", ignore = true)
    @Mapping(target = "followers", ignore = true)
    @Mapping(target = "reminders", ignore = true)
    @Mapping(target = "subtasks", ignore = true)
    @Mapping(target = "following", ignore = true)
    @Mapping(target = "canReassign", ignore = true)
    @Mapping(target = "canDelete", ignore = true)
    @Mapping(target = "canManageFollowers", ignore = true)
    KpiTaskResponse toResponse(KpiTask task);

    KpiTaskResponse.Reminder toReminder(com.kpitracking.entity.KpiTaskReminder reminder);

    KpiTaskResponse.ChecklistItem toChecklistItem(KpiTaskChecklistItem item);

    @Mapping(target = "image", expression = "java(CollabAttachmentPolicy.isImage(attachment.getContentType()))")
    @Mapping(target = "fromLibrary", expression = "java(attachment.getSourceDocumentId() != null)")
    @Mapping(target = "sourceDocumentId", ignore = true)
    KpiTaskResponse.Attachment toAttachment(KpiTaskAttachment attachment);

    @Mapping(target = "actorName", ignore = true)
    KpiTaskEventResponse toEventResponse(KpiTaskEvent event);
}
