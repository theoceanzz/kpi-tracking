package com.kpitracking.mapper;

import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.entity.EvidenceAttachment;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface EvidenceAttachmentMapper {
    AttachmentResponse toResponse(EvidenceAttachment attachment);
    List<AttachmentResponse> toResponseList(List<EvidenceAttachment> attachments);
}
