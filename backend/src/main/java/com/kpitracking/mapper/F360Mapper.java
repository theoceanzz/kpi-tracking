package com.kpitracking.mapper;

import com.kpitracking.dto.response.feedback360.F360AssignmentRowResponse;
import com.kpitracking.dto.response.feedback360.F360CampaignResponse;
import com.kpitracking.dto.response.feedback360.F360EventResponse;
import com.kpitracking.dto.response.feedback360.F360TemplateResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.F360Relationship;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * Ánh xạ entity 360 → DTO. Chỉ các phần thuần chép trường; con số tổng hợp (tiến độ, điểm) do
 * service đặt thêm sau khi map.
 */
@Mapper(componentModel = "spring")
public interface F360Mapper {

    @Mapping(target = "totalWeight", ignore = true)
    @Mapping(target = "competencies", ignore = true)
    @Mapping(target = "openQuestions", ignore = true)
    F360TemplateResponse toTemplateResponse(F360Template template);

    @Mapping(target = "questions", ignore = true)
    F360TemplateResponse.Competency toCompetencyResponse(F360Competency competency);

    F360TemplateResponse.Question toQuestionResponse(F360Question question);

    @Mapping(target = "kpiCycleId", source = "kpiCycle.id")
    @Mapping(target = "kpiCycleName", source = "kpiCycle.name")
    @Mapping(target = "templateId", source = "template.id")
    @Mapping(target = "templateName", source = "template.name")
    @Mapping(target = "createdByName", source = "createdBy.fullName")
    @Mapping(target = "relationshipWeights", ignore = true)
    @Mapping(target = "maxPeers", ignore = true)
    @Mapping(target = "maxDirectReports", ignore = true)
    @Mapping(target = "maxAssignmentsPerRater", ignore = true)
    @Mapping(target = "subjectCount", ignore = true)
    @Mapping(target = "assignmentCount", ignore = true)
    @Mapping(target = "submittedCount", ignore = true)
    @Mapping(target = "canManage", ignore = true)
    @Mapping(target = "maxNominees", ignore = true)
    @Mapping(target = "aiSummary", ignore = true)
    @Mapping(target = "orgAllowsRating", ignore = true)
    @Mapping(target = "competencyNames", ignore = true)
    @Mapping(target = "questionCount", ignore = true)
    F360CampaignResponse toCampaignResponse(F360Campaign campaign);

    @Mapping(target = "subjectId", source = "subject.id")
    @Mapping(target = "raterId", source = "rater.id")
    @Mapping(target = "raterName", source = "rater.fullName")
    @Mapping(target = "raterEmail", source = "rater.email")
    @Mapping(target = "raterAvatarUrl", source = "rater.avatarUrl")
    F360AssignmentRowResponse toAssignmentRow(F360Assignment assignment);

    @Mapping(target = "actorName", source = "actor.fullName")
    @Mapping(target = "subjectName", source = "subject.user.fullName")
    F360EventResponse toEventResponse(F360Event event);

    /** CSV tên enum → danh sách; rỗng/null = hỏi mọi nhóm. */
    default List<F360Relationship> relationships(String csv) {
        return com.kpitracking.util.F360Relationships.parse(csv);
    }
}
