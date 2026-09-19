package com.kpitracking.mapper;

import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.SubmissionAttachment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

// uses = SoftDeletedRefs: tên người nộp/duyệt và đợt KPI đọc được cả khi bản ghi đã xoá mềm
// (nếu không, proxy ném EntityNotFoundException và cả danh sách bài nộp đổ 500).
@Mapper(componentModel = "spring", uses = SoftDeletedRefs.class)
public interface SubmissionMapper {

    @Mapping(source = "kpiCriteria.id", target = "kpiCriteriaId")
    @Mapping(source = "kpiCriteria.name", target = "kpiCriteriaName")
    @Mapping(source = "kpiCriteria.kpiType", target = "kpiType")
    @Mapping(source = "kpiCriteria.targetValue", target = "targetValue")
    @Mapping(source = "qualitativeLevel.id", target = "qualitativeLevelId")
    @Mapping(source = "qualitativeLevel.name", target = "qualitativeLevelName")
    @Mapping(source = "qualitativeLevel.value", target = "qualitativeLevelValue")
    @Mapping(source = "submittedBy.id", target = "submittedById")
    @Mapping(source = "submittedBy", target = "submittedByName", qualifiedByName = "userName")
    @Mapping(source = "reviewedBy.id", target = "reviewedById")
    @Mapping(source = "reviewedBy", target = "reviewedByName", qualifiedByName = "userName")
    @Mapping(source = "kpiCriteria.unit", target = "unit")
    @Mapping(source = "kpiCriteria.weight", target = "weight")
    @Mapping(source = "kpiCriteria.kpiPeriod.id", target = "kpiPeriod.id")
    @Mapping(source = "kpiCriteria.kpiPeriod", target = "kpiPeriod.name", qualifiedByName = "periodName")
    @Mapping(source = "attachments", target = "attachments")
    @Mapping(target = "isSubmittedByManager", ignore = true)
    SubmissionResponse toResponse(KpiSubmission submission);

    AttachmentResponse toAttachmentResponse(SubmissionAttachment attachment);

    List<AttachmentResponse> toAttachmentResponseList(List<SubmissionAttachment> attachments);
}
