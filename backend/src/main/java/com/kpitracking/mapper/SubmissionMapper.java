package com.kpitracking.mapper;

import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.SubmissionAttachment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface SubmissionMapper {

    @Mapping(source = "kpiCriteria.id", target = "kpiCriteriaId")
    @Mapping(source = "kpiCriteria.name", target = "kpiCriteriaName")
    @Mapping(source = "kpiCriteria.targetValue", target = "targetValue")
    @Mapping(source = "submittedBy.id", target = "submittedById")
    @Mapping(source = "submittedBy.fullName", target = "submittedByName")
    @Mapping(source = "reviewedBy.id", target = "reviewedById")
    @Mapping(source = "reviewedBy.fullName", target = "reviewedByName")
    @Mapping(source = "attachments", target = "attachments")
    SubmissionResponse toResponse(KpiSubmission submission);

    AttachmentResponse toAttachmentResponse(SubmissionAttachment attachment);

    List<AttachmentResponse> toAttachmentResponseList(List<SubmissionAttachment> attachments);
}
